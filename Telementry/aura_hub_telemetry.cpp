/**
 * Aura Hub Telemetry Plugin for ETS2/ATS
 * =======================================
 * Minimal plugin - registers ONLY the 28 channels Aura Hub actually uses.
 * Drops ~70 unused channels from the generic ets2-sdk-plugin, which is
 * the primary cause of the 22-31 second shutdown delay.
 *
 * Build: Compile as x64 DLL with the SCS SDK headers.
 * Place in: Documents/Euro Truck Simulator 2/plugins/aura_hub_telemetry.dll
 *
 * Transport: Windows Named Shared Memory ("Local\\AuraHubTelemetry")
 * Reader: Your Tauri Rust backend reads this via invoke('get_telemetry_data')
 */

#define WINVER 0x0601
#define _WIN32_WINNT 0x0601

#include <windows.h>
#include <cstdio>
#include <cstring>
#include <cmath>

// SCS SDK headers (from https://modding.scssoft.com/wiki/Documentation/Tools/Telemetry_SDK)
#include "scssdk_telemetry.h"
#include "eurotrucks2/scssdk_eut2.h"
#include "eurotrucks2/scssdk_telemetry_eut2.h"
#include "amtrucks/scssdk_ats.h"
#include "amtrucks/scssdk_telemetry_ats.h"
#include "scssdk_telemetry_common_channels.h"
#include "scssdk_telemetry_truck_common_channels.h"
#include "scssdk_telemetry_trailer_common_channels.h"

// ============================================================
// Shared Memory Layout
// This struct is written by the plugin and read by Tauri/Rust.
// Keep in sync with your Rust struct in src-tauri.
// ============================================================

#define SHARED_MEM_NAME L"Local\\AuraHubTelemetry"
#define SHARED_MEM_VERSION 1

#pragma pack(push, 1)
struct AuraTelemetry {
    // --- Meta ---
    uint32_t version;           // Always SHARED_MEM_VERSION
    uint8_t  sdk_active;        // 1 = game running and SDK connected
    uint8_t  paused;            // 1 = game paused
    uint8_t  _pad[2];

    // --- Game time ---
    uint32_t game_time_minutes; // In-game time (minutes since midnight)
    float    local_scale;       // Time scale (1.0 = real time)
    int32_t  next_rest_stop;    // Minutes until rest stop required (-1 = N/A)

    // --- Truck dashboard ---
    float    speed;             // m/s (multiply by 3.6 for km/h)
    float    cruise_control_speed; // m/s, 0 if CC off
    uint8_t  cruise_control_on;
    uint8_t  engine_enabled;
    uint8_t  electric_enabled;
    uint8_t  wipers_on;

    // --- Fuel ---
    float    fuel;              // Litres remaining
    float    fuel_capacity;     // Max litres (from config event)
    float    fuel_avg_consumption; // L/km

    // --- Engine ---
    float    engine_rpm;
    float    engine_rpm_max;    // From config event
    int32_t  displayed_gear;    // Positive = forward, negative = reverse

    // --- Gear counts (from config) ---
    uint32_t gears_forward;
    uint32_t gears_reverse;

    // --- Truck identity (from config) ---
    char     truck_brand_id[32];
    char     truck_brand[64];
    char     truck_name[64];

    // --- Lights ---
    uint8_t  light_beam_low;
    uint8_t  light_beam_high;
    uint8_t  lblinker;          // Left blinker active
    uint8_t  rblinker;          // Right blinker active

    // --- Wear/Damage (0.0 = perfect, 1.0 = destroyed) ---
    float    wear_engine;
    float    wear_transmission;
    float    wear_cabin;
    float    wear_chassis;
    float    wear_wheels;       // Average across all wheels

    // --- Odometer ---
    float    odometer_km;

    // --- Navigation ---
    float    navigation_time;       // Seconds to destination
    float    navigation_distance;   // Metres to destination
    float    navigation_speed_limit; // m/s

    // --- Trailer ---
    uint8_t  trailer_attached;
    uint8_t  _pad2[3];
    float    trailer_wear_chassis;
    char     trailer_id[32];
    char     trailer_brand[64];

    // --- Job (from config + gameplay events) ---
    uint8_t  job_active;            // 1 = cargo loaded
    uint8_t  job_is_special;
    uint8_t  _pad3[2];
    uint64_t job_income;            // Expected income (in game currency)
    uint32_t job_delivery_time;     // Game minutes
    float    job_cargo_damage;      // 0.0 - 1.0
    float    job_cargo_mass;        // kg
    char     job_cargo_id[64];
    char     job_cargo_name[64];
    char     job_source_city[64];
    char     job_source_company[64];
    char     job_destination_city[64];
    char     job_destination_company[64];
    char     job_market[32];

    // --- Finance events (cumulative per session) ---
    int64_t  event_fine_amount;     // Last fine amount (game currency)
    uint32_t event_fine_count;
    int64_t  event_toll_amount;     // Last toll paid
    uint32_t event_toll_count;
};
#pragma pack(pop)

// ============================================================
// Plugin Globals
// ============================================================

static HANDLE           g_hMapFile   = NULL;
static AuraTelemetry*   g_pData      = NULL;
static scs_log_t        g_Log        = NULL;

// Helper to zero a string field safely
#define SAFE_STRCPY(dst, src) do { \
    strncpy_s(dst, sizeof(dst), src ? src : "", sizeof(dst) - 1); \
} while(0)

// ============================================================
// Channel Callbacks - all lightweight, just store value
// ============================================================

SCSAPI_VOID cb_speed(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->speed = value->value_float.value;
}
SCSAPI_VOID cb_cruise_control_speed(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->cruise_control_speed = value->value_float.value;
}
SCSAPI_VOID cb_cruise_control(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->cruise_control_on = value->value_bool.value ? 1 : 0;
}
SCSAPI_VOID cb_fuel(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->fuel = value->value_float.value;
}
SCSAPI_VOID cb_fuel_avg_consumption(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->fuel_avg_consumption = value->value_float.value;
}
SCSAPI_VOID cb_odometer(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->odometer_km = value->value_float.value;
}
SCSAPI_VOID cb_engine_rpm(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->engine_rpm = value->value_float.value;
}
SCSAPI_VOID cb_displayed_gear(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->displayed_gear = value->value_s32.value;
}
SCSAPI_VOID cb_wipers(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->wipers_on = value->value_bool.value ? 1 : 0;
}
SCSAPI_VOID cb_engine_enabled(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->engine_enabled = value->value_bool.value ? 1 : 0;
}
SCSAPI_VOID cb_electric_enabled(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->electric_enabled = value->value_bool.value ? 1 : 0;
}
SCSAPI_VOID cb_light_beam_low(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->light_beam_low = value->value_bool.value ? 1 : 0;
}
SCSAPI_VOID cb_light_beam_high(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->light_beam_high = value->value_bool.value ? 1 : 0;
}
SCSAPI_VOID cb_lblinker(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->lblinker = value->value_bool.value ? 1 : 0;
}
SCSAPI_VOID cb_rblinker(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->rblinker = value->value_bool.value ? 1 : 0;
}
SCSAPI_VOID cb_wear_engine(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->wear_engine = value->value_float.value;
}
SCSAPI_VOID cb_wear_transmission(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->wear_transmission = value->value_float.value;
}
SCSAPI_VOID cb_wear_cabin(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->wear_cabin = value->value_float.value;
}
SCSAPI_VOID cb_wear_chassis(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->wear_chassis = value->value_float.value;
}
SCSAPI_VOID cb_wear_wheels(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->wear_wheels = value->value_float.value;
}
SCSAPI_VOID cb_navigation_time(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->navigation_time = value->value_float.value;
}
SCSAPI_VOID cb_navigation_distance(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->navigation_distance = value->value_float.value;
}
SCSAPI_VOID cb_navigation_speed_limit(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->navigation_speed_limit = value->value_float.value;
}
SCSAPI_VOID cb_trailer_connected(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->trailer_attached = value->value_bool.value ? 1 : 0;
}
SCSAPI_VOID cb_trailer_wear_chassis(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->trailer_wear_chassis = value->value_float.value;
}
SCSAPI_VOID cb_game_time(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->game_time_minutes = value->value_u32.value;
}
SCSAPI_VOID cb_local_scale(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->local_scale = value->value_float.value;
}
SCSAPI_VOID cb_cargo_damage(const scs_string_t name, const scs_u32_t index, const scs_value_t* const value, const scs_context_t context) {
    if (g_pData && value) g_pData->job_cargo_damage = value->value_float.value;
}

// ============================================================
// Event Callbacks
// ============================================================

SCSAPI_VOID cb_paused(const scs_event_t event, const void* const event_info, const scs_context_t context) {
    if (g_pData) g_pData->paused = 1;
}

SCSAPI_VOID cb_unpaused(const scs_event_t event, const void* const event_info, const scs_context_t context) {
    if (g_pData) g_pData->paused = 0;
}

SCSAPI_VOID cb_configuration(const scs_event_t event, const void* const event_info, const scs_context_t context) {
    if (!g_pData) return;
    const scs_telemetry_configuration_t* config = static_cast<const scs_telemetry_configuration_t*>(event_info);
    if (!config || !config->id) return;

    // Walk attribute list
    for (const scs_named_value_t* attr = config->attributes; attr->name; ++attr) {
        // --- Truck config ---
        if (strcmp(config->id, SCS_TELEMETRY_CONFIG_truck) == 0) {
            if (strcmp(attr->name, "brand_id") == 0 && attr->value.type == SCS_VALUE_TYPE_string)
                SAFE_STRCPY(g_pData->truck_brand_id, attr->value.value_string.value);
            else if (strcmp(attr->name, "brand") == 0 && attr->value.type == SCS_VALUE_TYPE_string)
                SAFE_STRCPY(g_pData->truck_brand, attr->value.value_string.value);
            else if (strcmp(attr->name, "name") == 0 && attr->value.type == SCS_VALUE_TYPE_string)
                SAFE_STRCPY(g_pData->truck_name, attr->value.value_string.value);
            else if (strcmp(attr->name, "fuel.capacity") == 0 && attr->value.type == SCS_VALUE_TYPE_float)
                g_pData->fuel_capacity = attr->value.value_float.value;
            else if (strcmp(attr->name, "rpm.limit") == 0 && attr->value.type == SCS_VALUE_TYPE_float)
                g_pData->engine_rpm_max = attr->value.value_float.value;
            else if (strcmp(attr->name, "gears.forward") == 0 && attr->value.type == SCS_VALUE_TYPE_u32)
                g_pData->gears_forward = attr->value.value_u32.value;
            else if (strcmp(attr->name, "gears.reverse") == 0 && attr->value.type == SCS_VALUE_TYPE_u32)
                g_pData->gears_reverse = attr->value.value_u32.value;
        }
        // --- Job config ---
        else if (strcmp(config->id, SCS_TELEMETRY_CONFIG_job) == 0) {
            if (strcmp(attr->name, "cargo.id") == 0 && attr->value.type == SCS_VALUE_TYPE_string)
                SAFE_STRCPY(g_pData->job_cargo_id, attr->value.value_string.value);
            else if (strcmp(attr->name, "cargo") == 0 && attr->value.type == SCS_VALUE_TYPE_string)
                SAFE_STRCPY(g_pData->job_cargo_name, attr->value.value_string.value);
            else if (strcmp(attr->name, "cargo.mass") == 0 && attr->value.type == SCS_VALUE_TYPE_float)
                g_pData->job_cargo_mass = attr->value.value_float.value;
            else if (strcmp(attr->name, "source.city") == 0 && attr->value.type == SCS_VALUE_TYPE_string)
                SAFE_STRCPY(g_pData->job_source_city, attr->value.value_string.value);
            else if (strcmp(attr->name, "source.company") == 0 && attr->value.type == SCS_VALUE_TYPE_string)
                SAFE_STRCPY(g_pData->job_source_company, attr->value.value_string.value);
            else if (strcmp(attr->name, "destination.city") == 0 && attr->value.type == SCS_VALUE_TYPE_string)
                SAFE_STRCPY(g_pData->job_destination_city, attr->value.value_string.value);
            else if (strcmp(attr->name, "destination.company") == 0 && attr->value.type == SCS_VALUE_TYPE_string)
                SAFE_STRCPY(g_pData->job_destination_company, attr->value.value_string.value);
            else if (strcmp(attr->name, "income") == 0 && attr->value.type == SCS_VALUE_TYPE_u64)
                g_pData->job_income = (int64_t)attr->value.value_u64.value;
            else if (strcmp(attr->name, "delivery.time") == 0 && attr->value.type == SCS_VALUE_TYPE_u32)
                g_pData->job_delivery_time = attr->value.value_u32.value;
            else if (strcmp(attr->name, "is.special.job") == 0 && attr->value.type == SCS_VALUE_TYPE_bool)
                g_pData->job_is_special = attr->value.value_bool.value ? 1 : 0;
            else if (strcmp(attr->name, "job.market") == 0 && attr->value.type == SCS_VALUE_TYPE_string)
                SAFE_STRCPY(g_pData->job_market, attr->value.value_string.value);
            else if (strcmp(attr->name, "cargo.loaded") == 0 && attr->value.type == SCS_VALUE_TYPE_bool)
                g_pData->job_active = attr->value.value_bool.value ? 1 : 0;
        }
        // --- Trailer config ---
        else if (strncmp(config->id, SCS_TELEMETRY_CONFIG_trailer, strlen(SCS_TELEMETRY_CONFIG_trailer)) == 0
                 && config->index == 0) {
            if (strcmp(attr->name, "id") == 0 && attr->value.type == SCS_VALUE_TYPE_string)
                SAFE_STRCPY(g_pData->trailer_id, attr->value.value_string.value);
            else if (strcmp(attr->name, "brand") == 0 && attr->value.type == SCS_VALUE_TYPE_string)
                SAFE_STRCPY(g_pData->trailer_brand, attr->value.value_string.value);
        }
    }
}

SCSAPI_VOID cb_gameplay(const scs_event_t event, const void* const event_info, const scs_context_t context) {
    if (!g_pData) return;
    const scs_telemetry_gameplay_event_t* gev = static_cast<const scs_telemetry_gameplay_event_t*>(event_info);
    if (!gev || !gev->id) return;

    // Fine event
    if (strcmp(gev->id, SCS_TELEMETRY_GAMEPLAY_EVENT_player_fined) == 0) {
        for (const scs_named_value_t* attr = gev->attributes; attr->name; ++attr) {
            if (strcmp(attr->name, "fine.amount") == 0 && attr->value.type == SCS_VALUE_TYPE_s64) {
                g_pData->event_fine_amount = attr->value.value_s64.value;
                g_pData->event_fine_count++;
            }
        }
    }
    // Toll event
    else if (strcmp(gev->id, SCS_TELEMETRY_GAMEPLAY_EVENT_player_tollgate_paid) == 0) {
        for (const scs_named_value_t* attr = gev->attributes; attr->name; ++attr) {
            if (strcmp(attr->name, "pay.amount") == 0 && attr->value.type == SCS_VALUE_TYPE_s64) {
                g_pData->event_toll_amount = attr->value.value_s64.value;
                g_pData->event_toll_count++;
            }
        }
    }
    // Job delivered - update income with actual delivered value
    else if (strcmp(gev->id, SCS_TELEMETRY_GAMEPLAY_EVENT_job_delivered) == 0) {
        for (const scs_named_value_t* attr = gev->attributes; attr->name; ++attr) {
            if (strcmp(attr->name, "revenue") == 0 && attr->value.type == SCS_VALUE_TYPE_s64)
                g_pData->job_income = attr->value.value_s64.value;
        }
    }
    // Job cancelled
    else if (strcmp(gev->id, SCS_TELEMETRY_GAMEPLAY_EVENT_job_cancelled) == 0) {
        g_pData->job_active = 0;
        g_pData->job_income = 0;
    }
}

// ============================================================
// Plugin Entry Points
// ============================================================

SCSAPI_RESULT scs_telemetry_init(const scs_u32_t version, const scs_telemetry_init_params_t* const params) {
    if (version != SCS_TELEMETRY_VERSION_1_00) return SCS_RESULT_unsupported;

    const scs_telemetry_init_params_v100_t* p = static_cast<const scs_telemetry_init_params_v100_t*>(params);

    // Verify supported game
    if (strcmp(p->common.game_id, SCS_GAME_ID_EUT2) != 0 &&
        strcmp(p->common.game_id, SCS_GAME_ID_ATS) != 0) {
        p->common.log(SCS_LOG_TYPE_error, "Aura Hub: Unsupported game.");
        return SCS_RESULT_unsupported;
    }

    g_Log = p->common.log;
    g_Log(SCS_LOG_TYPE_message, "Aura Hub Telemetry Plugin: Initializing...");

    // --- Create Shared Memory ---
    g_hMapFile = CreateFileMappingW(
        INVALID_HANDLE_VALUE, NULL, PAGE_READWRITE,
        0, sizeof(AuraTelemetry), SHARED_MEM_NAME
    );
    if (!g_hMapFile) {
        g_Log(SCS_LOG_TYPE_error, "Aura Hub: Failed to create shared memory.");
        return SCS_RESULT_generic_error;
    }

    g_pData = static_cast<AuraTelemetry*>(
        MapViewOfFile(g_hMapFile, FILE_MAP_ALL_ACCESS, 0, 0, sizeof(AuraTelemetry))
    );
    if (!g_pData) {
        g_Log(SCS_LOG_TYPE_error, "Aura Hub: Failed to map shared memory.");
        CloseHandle(g_hMapFile);
        g_hMapFile = NULL;
        return SCS_RESULT_generic_error;
    }

    ZeroMemory(g_pData, sizeof(AuraTelemetry));
    g_pData->version    = SHARED_MEM_VERSION;
    g_pData->sdk_active = 1;
    g_pData->local_scale = 1.0f;

    // --- Register Events ---
    p->register_for_event(SCS_TELEMETRY_EVENT_paused,        cb_paused,        NULL);
    p->register_for_event(SCS_TELEMETRY_EVENT_started,       cb_unpaused,      NULL);
    p->register_for_event(SCS_TELEMETRY_EVENT_configuration, cb_configuration, NULL);
    p->register_for_event(SCS_TELEMETRY_EVENT_gameplay,      cb_gameplay,      NULL);

    // --- Register Channels (28 total - only what Aura Hub reads) ---
#define REG(name, idx, type, cb) \
    p->register_for_channel(name, idx, type, SCS_TELEMETRY_CHANNEL_FLAG_none, cb, NULL)

    // Game
    REG(SCS_TELEMETRY_CHANNEL_game_time,                      SCS_U32_NIL, SCS_VALUE_TYPE_u32,   cb_game_time);
    REG(SCS_TELEMETRY_CHANNEL_local_scale,                    SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_local_scale);

    // Truck dashboard
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_speed,                    SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_speed);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_cruise_control,           SCS_U32_NIL, SCS_VALUE_TYPE_bool,  cb_cruise_control);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_cruise_control_speed,     SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_cruise_control_speed);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_fuel,                     SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_fuel);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_fuel_average_consumption, SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_fuel_avg_consumption);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_odometer,                 SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_odometer);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_engine_rpm,               SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_engine_rpm);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_displayed_gear,           SCS_U32_NIL, SCS_VALUE_TYPE_s32,   cb_displayed_gear);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_wipers,                   SCS_U32_NIL, SCS_VALUE_TYPE_bool,  cb_wipers);

    // Truck state
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_engine_enabled,           SCS_U32_NIL, SCS_VALUE_TYPE_bool,  cb_engine_enabled);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_electric_enabled,         SCS_U32_NIL, SCS_VALUE_TYPE_bool,  cb_electric_enabled);

    // Lights
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_light_beam_low,           SCS_U32_NIL, SCS_VALUE_TYPE_bool,  cb_light_beam_low);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_light_beam_high,          SCS_U32_NIL, SCS_VALUE_TYPE_bool,  cb_light_beam_high);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_lblinker,                 SCS_U32_NIL, SCS_VALUE_TYPE_bool,  cb_lblinker);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_rblinker,                 SCS_U32_NIL, SCS_VALUE_TYPE_bool,  cb_rblinker);

    // Wear
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_wear_engine,              SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_wear_engine);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_wear_transmission,        SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_wear_transmission);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_wear_cabin,               SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_wear_cabin);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_wear_chassis,             SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_wear_chassis);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_wear_wheels,              SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_wear_wheels);

    // Navigation
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_navigation_time,          SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_navigation_time);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_navigation_distance,      SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_navigation_distance);
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_navigation_speed_limit,   SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_navigation_speed_limit);

    // Trailer (index 0 = first/only trailer)
    REG(SCS_TELEMETRY_TRAILER_CHANNEL_connected,              0,           SCS_VALUE_TYPE_bool,  cb_trailer_connected);
    REG(SCS_TELEMETRY_TRAILER_CHANNEL_wear_chassis,           0,           SCS_VALUE_TYPE_float, cb_trailer_wear_chassis);

    // Cargo damage
    REG(SCS_TELEMETRY_TRUCK_CHANNEL_cargo_damage,             SCS_U32_NIL, SCS_VALUE_TYPE_float, cb_cargo_damage);

#undef REG

    g_Log(SCS_LOG_TYPE_message, "Aura Hub Telemetry Plugin: Ready. 28 channels registered.");
    return SCS_RESULT_ok;
}

SCSAPI_VOID scs_telemetry_shutdown(void) {
    // Signal to readers that plugin is closing
    if (g_pData) {
        g_pData->sdk_active = 0;
    }

    // Unmap and close - instant, no blocking
    if (g_pData) {
        UnmapViewOfFile(g_pData);
        g_pData = NULL;
    }
    if (g_hMapFile) {
        CloseHandle(g_hMapFile);
        g_hMapFile = NULL;
    }

    if (g_Log) {
        g_Log(SCS_LOG_TYPE_message, "Aura Hub Telemetry Plugin: Shutdown complete.");
    }
}

// ============================================================
// DllMain - minimal, no work here
// ============================================================
BOOL APIENTRY DllMain(HMODULE hModule, DWORD reason, LPVOID reserved) {
    return TRUE;
}

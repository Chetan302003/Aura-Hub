// src-tauri/src/telemetry.rs
// Reads the AuraTelemetry shared memory written by aura_hub_telemetry.dll
// Add to Tauri as: #[tauri::command] get_telemetry_data

use serde::Serialize;
use std::ffi::OsStr;
use std::iter::once;
use std::os::windows::ffi::OsStrExt;
use windows::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE};
use windows::Win32::System::Memory::{
    MapViewOfFile, OpenFileMappingW, UnmapViewOfFile, FILE_MAP_READ, PAGE_READONLY,
};

const SHARED_MEM_NAME: &str = "Local\\AuraHubTelemetry";
const SHARED_MEM_VERSION: u32 = 1;

/// Mirror of the C++ AuraTelemetry struct (must match exactly, packed)
/// Keep this in sync with aura_hub_telemetry.cpp
#[repr(C, packed)]
#[derive(Copy, Clone)]
struct AuraTelemetryRaw {
    version: u32,
    sdk_active: u8,
    paused: u8,
    _pad: [u8; 2],

    game_time_minutes: u32,
    local_scale: f32,
    next_rest_stop: i32,

    speed: f32,
    cruise_control_speed: f32,
    cruise_control_on: u8,
    engine_enabled: u8,
    electric_enabled: u8,
    wipers_on: u8,

    fuel: f32,
    fuel_capacity: f32,
    fuel_avg_consumption: f32,

    engine_rpm: f32,
    engine_rpm_max: f32,
    displayed_gear: i32,

    gears_forward: u32,
    gears_reverse: u32,

    truck_brand_id: [u8; 32],
    truck_brand: [u8; 64],
    truck_name: [u8; 64],

    light_beam_low: u8,
    light_beam_high: u8,
    lblinker: u8,
    rblinker: u8,

    wear_engine: f32,
    wear_transmission: f32,
    wear_cabin: f32,
    wear_chassis: f32,
    wear_wheels: f32,

    odometer_km: f32,

    navigation_time: f32,
    navigation_distance: f32,
    navigation_speed_limit: f32,

    trailer_attached: u8,
    _pad2: [u8; 3],
    trailer_wear_chassis: f32,
    trailer_id: [u8; 32],
    trailer_brand: [u8; 64],

    job_active: u8,
    job_is_special: u8,
    _pad3: [u8; 2],
    job_income: i64,
    job_delivery_time: u32,
    job_cargo_damage: f32,
    job_cargo_mass: f32,
    job_cargo_id: [u8; 64],
    job_cargo_name: [u8; 64],
    job_source_city: [u8; 64],
    job_source_company: [u8; 64],
    job_destination_city: [u8; 64],
    job_destination_company: [u8; 64],
    job_market: [u8; 32],

    event_fine_amount: i64,
    event_fine_count: u32,
    event_toll_amount: i64,
    event_toll_count: u32,
}

// ---- Clean JSON types for Tauri/TypeScript ----

#[derive(Serialize)]
pub struct TelemetryGame {
    pub connected: bool,
    pub paused: bool,
    pub game_time_minutes: u32,
    pub local_scale: f32,
    pub next_rest_stop: i32,
}

#[derive(Serialize)]
pub struct TelemetryTruck {
    pub brand_id: String,
    pub brand: String,
    pub name: String,
    pub speed_ms: f32,         // m/s — frontend multiplies by 3.6 for km/h
    pub speed_kmh: f32,        // convenience: already converted
    pub cruise_control_on: bool,
    pub cruise_control_speed_kmh: f32,
    pub fuel: f32,
    pub fuel_capacity: f32,
    pub fuel_avg_consumption: f32,
    pub odometer_km: f32,
    pub engine_rpm: f32,
    pub engine_rpm_max: f32,
    pub displayed_gear: i32,
    pub gears_forward: u32,
    pub gears_reverse: u32,
    pub engine_enabled: bool,
    pub electric_enabled: bool,
    pub wipers_on: bool,
    pub light_beam_low: bool,
    pub light_beam_high: bool,
    pub lblinker: bool,
    pub rblinker: bool,
    pub wear_engine: f32,
    pub wear_transmission: f32,
    pub wear_cabin: f32,
    pub wear_chassis: f32,
    pub wear_wheels: f32,
    pub navigation_time_s: f32,
    pub navigation_distance_m: f32,
    pub navigation_speed_limit_kmh: f32,
}

#[derive(Serialize)]
pub struct TelemetryTrailer {
    pub attached: bool,
    pub id: String,
    pub brand: String,
    pub wear_chassis: f32,
}

#[derive(Serialize)]
pub struct TelemetryJob {
    pub cargo_id: String,
    pub cargo_name: String,
    pub cargo_mass_kg: f32,
    pub cargo_damage: f32,
    pub source_city: String,
    pub source_company: String,
    pub destination_city: String,
    pub destination_company: String,
    pub income: i64,
    pub delivery_time_minutes: u32,
    pub is_special: bool,
    pub market: String,
}

#[derive(Serialize)]
pub struct TelemetryFinance {
    pub last_fine_amount: i64,
    pub fine_count: u32,
    pub last_toll_amount: i64,
    pub toll_count: u32,
}

#[derive(Serialize)]
pub struct TelemetryData {
    pub game: TelemetryGame,
    pub truck: TelemetryTruck,
    pub trailer: TelemetryTrailer,
    pub job: Option<TelemetryJob>,
    pub finance: TelemetryFinance,
    /// True when plugin set sdk_active=0 (game closing)
    pub closing: bool,
}

// ---- Helpers ----

fn read_cstr(bytes: &[u8]) -> String {
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).into_owned()
}

fn wide(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().chain(once(0)).collect()
}

// ---- Main Tauri command ----

#[tauri::command]
pub fn get_telemetry_data() -> Result<TelemetryData, String> {
    unsafe {
        // Open the shared memory (read-only — plugin owns it)
        let name = wide(SHARED_MEM_NAME);
        let hmap = OpenFileMappingW(FILE_MAP_READ.0, false, windows::core::PCWSTR(name.as_ptr()))
            .map_err(|e| format!("OpenFileMapping failed: {e}"))?;

        if hmap.is_invalid() {
            return Err("Shared memory not found — is the plugin loaded?".into());
        }

        let ptr = MapViewOfFile(hmap, FILE_MAP_READ, 0, 0, std::mem::size_of::<AuraTelemetryRaw>());
        if ptr.Value.is_null() {
            CloseHandle(hmap).ok();
            return Err("MapViewOfFile failed".into());
        }

        // Copy out atomically (single memcpy, avoids torn reads)
        let raw = std::ptr::read_unaligned(ptr.Value as *const AuraTelemetryRaw);

        UnmapViewOfFile(ptr).ok();
        CloseHandle(hmap).ok();

        // Version check
        if raw.version != SHARED_MEM_VERSION {
            return Err(format!(
                "Shared memory version mismatch: got {}, expected {SHARED_MEM_VERSION}",
                raw.version
            ));
        }

        let closing = raw.sdk_active == 0;

        let game = TelemetryGame {
            connected: raw.sdk_active == 1,
            paused: raw.paused == 1,
            game_time_minutes: raw.game_time_minutes,
            local_scale: raw.local_scale,
            next_rest_stop: raw.next_rest_stop,
        };

        let truck = TelemetryTruck {
            brand_id: read_cstr(&raw.truck_brand_id),
            brand: read_cstr(&raw.truck_brand),
            name: read_cstr(&raw.truck_name),
            speed_ms: raw.speed,
            speed_kmh: raw.speed * 3.6,
            cruise_control_on: raw.cruise_control_on == 1,
            cruise_control_speed_kmh: raw.cruise_control_speed * 3.6,
            fuel: raw.fuel,
            fuel_capacity: raw.fuel_capacity,
            fuel_avg_consumption: raw.fuel_avg_consumption,
            odometer_km: raw.odometer_km,
            engine_rpm: raw.engine_rpm,
            engine_rpm_max: raw.engine_rpm_max,
            displayed_gear: raw.displayed_gear,
            gears_forward: raw.gears_forward,
            gears_reverse: raw.gears_reverse,
            engine_enabled: raw.engine_enabled == 1,
            electric_enabled: raw.electric_enabled == 1,
            wipers_on: raw.wipers_on == 1,
            light_beam_low: raw.light_beam_low == 1,
            light_beam_high: raw.light_beam_high == 1,
            lblinker: raw.lblinker == 1,
            rblinker: raw.rblinker == 1,
            wear_engine: raw.wear_engine,
            wear_transmission: raw.wear_transmission,
            wear_cabin: raw.wear_cabin,
            wear_chassis: raw.wear_chassis,
            wear_wheels: raw.wear_wheels,
            navigation_time_s: raw.navigation_time,
            navigation_distance_m: raw.navigation_distance,
            navigation_speed_limit_kmh: raw.navigation_speed_limit * 3.6,
        };

        let trailer = TelemetryTrailer {
            attached: raw.trailer_attached == 1,
            id: read_cstr(&raw.trailer_id),
            brand: read_cstr(&raw.trailer_brand),
            wear_chassis: raw.trailer_wear_chassis,
        };

        let job = if raw.job_active == 1 {
            Some(TelemetryJob {
                cargo_id: read_cstr(&raw.job_cargo_id),
                cargo_name: read_cstr(&raw.job_cargo_name),
                cargo_mass_kg: raw.job_cargo_mass,
                cargo_damage: raw.job_cargo_damage,
                source_city: read_cstr(&raw.job_source_city),
                source_company: read_cstr(&raw.job_source_company),
                destination_city: read_cstr(&raw.job_destination_city),
                destination_company: read_cstr(&raw.job_destination_company),
                income: raw.job_income,
                delivery_time_minutes: raw.job_delivery_time,
                is_special: raw.job_is_special == 1,
                market: read_cstr(&raw.job_market),
            })
        } else {
            None
        };

        let finance = TelemetryFinance {
            last_fine_amount: raw.event_fine_amount,
            fine_count: raw.event_fine_count,
            last_toll_amount: raw.event_toll_amount,
            toll_count: raw.event_toll_count,
        };

        Ok(TelemetryData { game, truck, trailer, job, finance, closing })
    }
}

use scs_sdk_telemetry::shared_memory::SharedMemory;
use std::thread;
use std::time::Duration;

fn main() {
    println!("--- AURA COMPREHENSIVE TELEMETRY PROBE ---");
    
    match SharedMemory::connect() {
        Ok(mut shared_mem) => {
            println!("✅ CONNECTED: SCS Shared Memory detected.");
            
            loop {
                let mut data = shared_mem.read();
                
                print!("{}[2J", 27 as char); 
                println!("=== [ AURA HUB: LIVE SYSTEM CHECK ] ===");

                // 1. GAME STATUS
                println!("\n[ GAME ]");
                // Removed the specific version field to prevent compile error
                println!("Game: Detected and Connected");

                // 2. TRUCK CORE
                println!("\n[ TRUCK CORE ]");
                println!("Identity: {} {}", data.truck.constants.brand, data.truck.constants.name);
                println!("Speed: {:.1} km/h", data.truck.current.dashboard.speed.value * 3.6);
                println!("RPM: {:.0} | Gear: {}", 
                    data.truck.current.dashboard.rpm, 
                    data.truck.current.dashboard.gear_dashboards
                );
                
                // Handling fuel (Simplified to ensure compilation)
                println!("Fuel: {:.1}L", data.truck.current.dashboard.fuel.amount);

                // 3. TRUCK ELECTRONICS
                println!("\n[ TRUCK ELECTRONICS ]");
                println!("Blinkers: L:{} R:{}", 
                    data.truck.current.lights.blinker_left_on, 
                    data.truck.current.lights.blinker_right_on
                );

                // 4. DAMAGE REPORT
                println!("\n[ DAMAGE REPORT ]");
                println!("Engine Damage: {:.1}%", data.truck.current.damage.engine * 100.0);

                // 5. JOB & CARGO
                println!("\n[ JOB & CARGO ]");
                if data.job.cargo_loaded {
                    println!("Source: {} | Dest: {}", 
                        data.job.city_source,
                        data.job.city_destination
                    );
                    println!("Income: ${}", data.job.income);
                } else {
                    println!("No active job detected.");
                }

                // 6. TRAILERS (Fixed: Damage is top-level in Trailer struct)
                println!("\n[ TRAILERS ]");
                if !data.trailers.is_empty() {
                    let main_trailer = &data.trailers[0];
                    println!("Trailer Damage: {:.1}%", 
                        main_trailer.damage.chassis * 100.0
                    );
                } else {
                    println!("No trailer attached.");
                }println!("{}", data.to_json().unwrap().to_string());


                println!("\n-------------------------------------------");
                thread::sleep(Duration::from_millis(500));
            }
        }
        Err(e) => {
            println!("❌ ERROR: Connection failed: {}", e);
        }
    }
}
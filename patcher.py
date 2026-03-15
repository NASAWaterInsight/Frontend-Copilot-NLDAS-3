#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════════
  PATCHER: Add OL variable units to frontend
═══════════════════════════════════════════════════════════════════════

Problem: Evap, SoilM, VPD etc. show no unit on the colorbar legend
Fix: Add all OL variables to getVariableUnit() in HydrologyDarkChat.tsx

Usage:
    cd Frontend-Copilot-NLDAS-3   (or wherever your frontend src is)
    python3 patch_frontend_units.py

Restore:
    cp src/components/HydrologyDarkChat.tsx.bak src/components/HydrologyDarkChat.tsx
═══════════════════════════════════════════════════════════════════════
"""

import os, sys, shutil, glob


def find_file():
    """Find HydrologyDarkChat.tsx in common locations"""
    candidates = [
        "src/components/HydrologyDarkChat.tsx",
        "frontend/src/components/HydrologyDarkChat.tsx",
        "../frontend/src/components/HydrologyDarkChat.tsx",
        "../Frontend-Copilot-NLDAS-3/src/components/HydrologyDarkChat.tsx",
    ]
    # Also search recursively
    found = glob.glob("**/HydrologyDarkChat.tsx", recursive=True)
    candidates.extend(found)
    
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def main():
    print("═" * 60)
    print("  Patching HydrologyDarkChat.tsx (variable units)")
    print("═" * 60)

    filepath = find_file()
    if not filepath:
        print("  ❌ Could not find HydrologyDarkChat.tsx")
        print("  Please run from your frontend project directory")
        print("  Or specify the path manually in the script")
        sys.exit(1)

    print(f"  📄 Found: {filepath}")

    backup = filepath + ".bak"
    if not os.path.exists(backup):
        shutil.copy2(filepath, backup)
        print(f"  📋 Backed up → {backup}")
    else:
        print(f"  📋 Backup exists: {backup}")

    with open(filepath, 'r') as f:
        content = f.read()

    if "'Evap': 'mm/day'" in content:
        print("  ✅ Already patched.")
        return

    changes = 0

    # ══════════════════════════════════════════════════════════
    # FIX 1: Add OL variables to getVariableUnit()
    # ══════════════════════════════════════════════════════════
    old_unit_map = """      'SPI': '',
      'SPI3': '',
      'spi': ''
    }"""

    new_unit_map = """      'SPI': '',
      'SPI3': '',
      'spi': '',
      // Open Loop variables
      'Evap': 'mm/day',
      'PotEvap': 'mm/day',
      'ECanop': 'mm/day',
      'ESoil': 'mm/day',
      'TVeg': 'mm/day',
      'Qs': 'mm/day',
      'Qsb': 'mm/day',
      'Snowf': 'mm/day',
      'SoilM_0_10cm': 'm³/m³',
      'SoilM_10_40cm': 'm³/m³',
      'SoilM_40_100cm': 'm³/m³',
      'SoilM_100_200cm': 'm³/m³',
      'SoilM_root_zone': 'm³/m³',
      'VPD': 'kPa',
      'SWE': 'kg/m²',
      'SnowDepth': 'cm',
      'SnowFrac': '',
      'AvgSurfT': '°C',
      'AvgSurfT_max': '°C',
      'AvgSurfT_min': '°C',
      'SoilT_0_10cm': '°C',
      'SoilT_10_40cm': '°C',
      'SoilT_40_100cm': '°C',
      'SoilT_100_200cm': '°C',
      'LAI': '',
      'GPP': 'g/m²/day',
      'NEE': 'g/m²/day',
      'NPP': 'g/m²/day',
      'TWS': 'mm',
      'GWS': 'mm',
      'WaterTableD': 'm',
      'CanopInt': 'kg/m²',
      'LWnet': 'W/m²',
      'SWnet': 'W/m²',
      'Qh': 'W/m²',
      'Qle': 'W/m²',
      'Qg': 'W/m²',
      'LWdown': 'W/m²',
      'SWdown': 'W/m²',
      'PSurf': 'Pa',
      // Crop yield
      'corn_yield': 'kg/ha',
      // Forcing monthly
      'Rainf': 'mm'
    }"""

    if old_unit_map in content:
        content = content.replace(old_unit_map, new_unit_map, 1)
        changes += 1
        print("  ✅ FIX 1: Added OL variable units to getVariableUnit()")
    else:
        print("  ⚠️  FIX 1: Could not find unit map in getVariableUnit()")
        # Try alternate pattern
        alt = "'spi': ''\n    }"
        if alt in content:
            content = content.replace(alt, new_unit_map.split("'spi': '',")[1], 1)
            changes += 1
            print("  ✅ FIX 1 (alt): Added OL variable units")
        else:
            print("  ❌ FIX 1: Could not find any unit map pattern")

    # ══════════════════════════════════════════════════════════
    # FIX 2: Add OL variables to getDisplayName()
    # Check if already has OL display names
    # ══════════════════════════════════════════════════════════
    if "'Evap': 'Evapotranspiration'" not in content:
        old_display = """      'temperature': 'Temperature'
    }"""
        
        new_display = """      'temperature': 'Temperature',
      // Open Loop variables
      'Evap': 'Evapotranspiration',
      'PotEvap': 'Potential ET',
      'ECanop': 'Canopy Evaporation',
      'ESoil': 'Soil Evaporation',
      'TVeg': 'Transpiration',
      'Qs': 'Surface Runoff',
      'Qsb': 'Baseflow Runoff',
      'Snowf': 'Snowfall',
      'SoilM_0_10cm': 'Soil Moisture (0-10cm)',
      'SoilM_10_40cm': 'Soil Moisture (10-40cm)',
      'SoilM_40_100cm': 'Soil Moisture (40-100cm)',
      'SoilM_100_200cm': 'Soil Moisture (100-200cm)',
      'SoilM_root_zone': 'Root-Zone Soil Moisture',
      'VPD': 'Vapor Pressure Deficit',
      'SWE': 'Snow Water Equivalent',
      'SnowDepth': 'Snow Depth',
      'AvgSurfT': 'Surface Temperature',
      'SoilT_0_10cm': 'Soil Temp (0-10cm)',
      'SoilT_10_40cm': 'Soil Temp (10-40cm)',
      'SoilT_40_100cm': 'Soil Temp (40-100cm)',
      'SoilT_100_200cm': 'Soil Temp (100-200cm)',
      'LAI': 'Leaf Area Index',
      'GPP': 'Gross Primary Prod.',
      'NEE': 'Net Ecosystem Exchange',
      'NPP': 'Net Primary Prod.',
      'TWS': 'Total Water Storage',
      'GWS': 'Groundwater Storage',
      'WaterTableD': 'Water Table Depth',
      'Qh': 'Sensible Heat Flux',
      'Qle': 'Latent Heat Flux',
      'Qg': 'Ground Heat Flux',
      'LWnet': 'Net Longwave',
      'SWnet': 'Net Shortwave',
      'LWdown': 'Longwave Down',
      'SWdown': 'Shortwave Down',
      'PSurf': 'Surface Pressure',
      'corn_yield': 'Corn Yield',
      'Rainf': 'Precipitation'
    }"""

        if old_display in content:
            content = content.replace(old_display, new_display, 1)
            changes += 1
            print("  ✅ FIX 2: Added OL variable display names to getDisplayName()")
        else:
            print("  ⚠️  FIX 2: Could not find display name map (may already have custom names)")
    else:
        print("  ✅ FIX 2: OL display names already exist")

    with open(filepath, 'w') as f:
        f.write(content)

    print(f"\n  {'✅' if changes > 0 else '❌'} {filepath} — {changes} changes")
    print(f"""
  VARIABLES ADDED:
    Evap → mm/day          SoilM_0_10cm → m³/m³
    PotEvap → mm/day       VPD → kPa
    Qs → mm/day            SWE → kg/m²
    Qsb → mm/day           SnowDepth → cm
    GPP → g/m²/day         LAI → (unitless)
    TWS → mm               GWS → mm
    AvgSurfT → °C          corn_yield → kg/ha
    + 20 more

  REBUILD FRONTEND:
    npm run dev   (or npm run build)

  RESTORE:
    cp {filepath}.bak {filepath}
""")


if __name__ == "__main__":
    main()
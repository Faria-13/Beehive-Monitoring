# Beehive-Monitoring System 

The Beehive Monitoring System is a low-power IoT solution designed to monitor hive health in remote environments.

Sensor nodes at a beehive collect environmental data and transmit it via LoRaWAN to a backend system, where it is processed, stored, and visualized in a dashboard.

# Key Features
Real-time monitoring of temperature, humidity, CO₂, and pressure (every 10 minutes)
Works in remote locations without Wi-Fi using LoRaWAN
Multi-hive monitoring through a single gateway
Instant SMS alerts for abnormal readings
No-data detection for sensor failures
Role-based user access (admin + users)
Daily, hourly, and 2-week data visualization

# System Architecture
Sensor Node (ESP32)
        ↓
     LoRaWAN
        ↓
     Gateway
        ↓
 Backend / API
        ↓
     Database (Supabase)

# Hardware Components
ESP32 LoRa Board (SX1262)
SCD41 Sensor (CO₂, Temperature, Humidity)
BMP180 Sensor (Pressure)
18650 Battery + Solar Panel


# How It Works
1. Sensors collect environmental data
2. Data is packaged into a compact payload
3. ESP32 transmits data via LoRa every 10 minutes
4. Gateway receives and forwards data
5. Backend parses and stores data in database and triggers SMS alerts
6. Dashboard displays real-time and historical data and alerts

# Backend
1. Handles data ingestion and parsing
2. Converts raw payloads into structured data
3. Stores data in database (Supabase)
4. Supports multi-hive data tracking

# Frontend (Dashboard)

The frontend application provides a user interface for monitoring hive data.
- Displays real-time and historical sensor data  
- Supports hourly, daily, and 2-week views  
- Includes role-based access (admin vs user)  
- Allows monitoring of multiple hives from a single account  

# Repository Structure
This repository is organized into hardware, backend, and application components:
- `heltec-sensors/` – Firmware for the sensor node (data collection, LoRa transmission, power management)  
- `beehive/` – React frontend web application for displaying hive data (dashboard UI)
- `gateway/` –  mock test script to test RIT Wifi and HTTP Post request to Supabase 
- `supabase/` – Edge Function to pull external API data 
- `sx1302_hal/` – LoRa gateway hardware abstraction layer
- `node_modules/` – Project dependancies 


# Power System
Battery-powered with solar charging
Optimized for long-term, low-power operation
Voltage monitored to ensure system reliability

# Team
Mohamed Abdullah Najumudeen - Project Manager
Anthony Roque - System Administrator
Faria Sultana - Backend Developer
Juan Gomez Botero - Frontend Developer
Emily Winnick - Frontend & UI/UX Designer
Drew Silberman - Database Administrator



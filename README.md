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
     Database

# Hardware Components
ESP32 LoRa Board (SX1262)
SCD41 Sensor (CO₂, Temperature, Humidity)
BMP180 Sensor (Pressure)
18650 Battery + Solar Panel
Voltage Monitoring Circuit

# How It Works
Sensors collect environmental data
Data is packaged into a compact payload
ESP32 transmits data via LoRa every 10 minutes
Gateway receives and forwards data
Backend parses and stores data in database
Dashboard displays real-time and historical data

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
- `backend/` – Backend services including data ingestion, payload parsing, and database integration  
- `gateway/` – Web application (frontend dashboard, UI, authentication)  
- `supabase/` – Schema and configuration for storing sensor, hive, and user data

# Power System
Battery-powered with solar charging
Optimized for long-term, low-power operation
Voltage monitored to ensure system reliability

# Team
Abdullah Najumdeen – Project Manager
Anthony Roque – Hardware Systems Lead
Faria Sultana – Systems & Integration Lead
Juan – Backend Engineer
Emily – Frontend & UI/UX Designer
Drew Silberman – Database Engineer



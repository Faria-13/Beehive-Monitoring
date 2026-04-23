-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_user_id (
  user_id integer
);
CREATE TABLE public.alert_rules (
  rule_id integer NOT NULL DEFAULT nextval('alert_rules_rule_id_seq'::regclass),
  hive_id integer NOT NULL,
  rule_name character varying NOT NULL,
  sensor_type USER-DEFINED NOT NULL,
  condition_type USER-DEFINED NOT NULL,
  threshold_value numeric NOT NULL,
  duration_minutes integer DEFAULT 0,
  alert_level USER-DEFINED NOT NULL DEFAULT 'warning'::alert_type,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT alert_rules_pkey PRIMARY KEY (rule_id),
  CONSTRAINT alert_rules_hive_id_fkey FOREIGN KEY (hive_id) REFERENCES public.beehives(hive_id)
);
CREATE TABLE public.alerts (
  alert_id integer NOT NULL DEFAULT nextval('alerts_alert_id_seq'::regclass),
  hive_id integer NOT NULL,
  rule_id integer,
  alert_type USER-DEFINED NOT NULL,
  alert_level character varying NOT NULL,
  message text NOT NULL,
  sensor_value numeric,
  timestamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  acknowledged boolean DEFAULT false,
  acknowledged_at timestamp with time zone,
  acknowledged_by integer,
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  notes text,
  CONSTRAINT alerts_pkey PRIMARY KEY (alert_id),
  CONSTRAINT alerts_hive_id_fkey FOREIGN KEY (hive_id) REFERENCES public.beehives(hive_id),
  CONSTRAINT alerts_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.alert_rules(rule_id),
  CONSTRAINT alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.audit_logs (
  log_id bigint NOT NULL DEFAULT nextval('audit_logs_log_id_seq'::regclass),
  user_id integer,
  action_type character varying NOT NULL,
  entity_type character varying NOT NULL,
  entity_id integer,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  description text,
  timestamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (log_id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.beehives (
  hive_id integer NOT NULL DEFAULT nextval('beehives_hive_id_seq'::regclass),
  owner_id integer NOT NULL,
  hive_code character varying NOT NULL UNIQUE CHECK (hive_code::text ~ '^[A-Za-z0-9]{8,16}$'::text),
  latitude numeric NOT NULL CHECK (latitude >= '-90'::integer::numeric AND latitude <= 90::numeric),
  longitude numeric NOT NULL CHECK (longitude >= '-180'::integer::numeric AND longitude <= 180::numeric),
  location_description character varying,
  installation_date date NOT NULL CHECK (installation_date <= CURRENT_DATE),
  hive_status USER-DEFINED DEFAULT 'active'::hive_status,
  notes text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  avatar_type text DEFAULT 'default'::text,
  avatar_storage_path text DEFAULT 'nullable'::text,
  avatar_bg_color text DEFAULT 'nullable'::text,
  CONSTRAINT beehives_pkey PRIMARY KEY (hive_id),
  CONSTRAINT beehives_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.gateways (
  gateway_id integer NOT NULL DEFAULT nextval('gateways_gateway_id_seq'::regclass),
  gateway_name character varying NOT NULL,
  mac_address character varying NOT NULL UNIQUE CHECK (mac_address::text ~* '^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$'::text),
  ip_address inet,
  latitude numeric CHECK (latitude IS NULL OR latitude >= '-90'::integer::numeric AND latitude <= 90::numeric),
  longitude numeric CHECK (longitude IS NULL OR longitude >= '-180'::integer::numeric AND longitude <= 180::numeric),
  firmware_version character varying,
  status USER-DEFINED DEFAULT 'offline'::gateway_status,
  last_heartbeat timestamp with time zone,
  tls_certificate_expiry timestamp with time zone,
  max_boards integer DEFAULT 50,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT gateways_pkey PRIMARY KEY (gateway_id)
);
CREATE TABLE public.iot_boards (
  board_id integer NOT NULL DEFAULT nextval('iot_boards_board_id_seq'::regclass),
  hive_id integer,
  gateway_id integer,
  board_name character varying NOT NULL,
  mac_address character varying NOT NULL UNIQUE CHECK (mac_address::text ~* '^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$'::text),
  firmware_version character varying,
  hardware_specs character varying,
  battery_level numeric,
  status USER-DEFINED DEFAULT 'offline'::board_status,
  last_heartbeat timestamp with time zone,
  calibration_interval integer DEFAULT 90,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT iot_boards_pkey PRIMARY KEY (board_id),
  CONSTRAINT iot_boards_gateway_id_fkey FOREIGN KEY (gateway_id) REFERENCES public.gateways(gateway_id),
  CONSTRAINT fk_iot_boards_hive FOREIGN KEY (hive_id) REFERENCES public.beehives(hive_id)
);
CREATE TABLE public.notifications (
  notification_id integer NOT NULL DEFAULT nextval('notifications_notification_id_seq'::regclass),
  user_id integer NOT NULL,
  alert_id integer,
  notification_type USER-DEFINED NOT NULL,
  recipient character varying NOT NULL,
  message text NOT NULL,
  sent_at timestamp with time zone,
  delivery_status USER-DEFINED DEFAULT 'pending'::notification_status,
  delivery_attempts integer DEFAULT 0,
  error_message character varying,
  CONSTRAINT notifications_pkey PRIMARY KEY (notification_id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT notifications_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.alerts(alert_id)
);
CREATE TABLE public.sensor_readings (
  reading_id bigint NOT NULL DEFAULT nextval('sensor_readings_reading_id_seq'::regclass),
  sensor_id integer NOT NULL,
  timestamp timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  value numeric NOT NULL,
  unit character varying NOT NULL,
  is_valid boolean DEFAULT true,
  error_flag boolean DEFAULT false,
  buffered boolean DEFAULT false,
  error_message character varying,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sensor_readings_pkey PRIMARY KEY (reading_id),
  CONSTRAINT sensor_readings_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES public.sensors(sensor_id)
);
CREATE TABLE public.sensors (
  sensor_id integer NOT NULL DEFAULT nextval('sensors_sensor_id_seq'::regclass),
  board_id integer NOT NULL,
  sensor_type USER-DEFINED NOT NULL,
  sensor_model character varying,
  unit character varying NOT NULL,
  calibration_date timestamp with time zone,
  calibration_required_next timestamp with time zone,
  status character varying DEFAULT 'active'::character varying,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sensors_pkey PRIMARY KEY (sensor_id),
  CONSTRAINT sensors_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.iot_boards(board_id)
);
CREATE TABLE public.users (
  user_id integer NOT NULL DEFAULT nextval('users_user_id_seq'::regclass),
  email character varying NOT NULL UNIQUE CHECK (email::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text),
  password_hash character varying NOT NULL,
  user_type USER-DEFINED NOT NULL DEFAULT 'beekeeper'::user_type,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  phone_number character varying CHECK (phone_number IS NULL OR phone_number::text ~ '^\+?[0-9]{10,15}$'::text),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  last_login timestamp with time zone,
  password_changed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  account_status USER-DEFINED DEFAULT 'pending'::account_status,
  failed_login_attempts integer DEFAULT 0,
  last_failed_login timestamp with time zone,
  CONSTRAINT users_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.weather_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  location text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  temp_c double precision,
  wind_kmh double precision,
  weather jsonb,
  CONSTRAINT weather_logs_pkey PRIMARY KEY (id)
);
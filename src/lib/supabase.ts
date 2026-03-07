import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gnnlkegwunykdshdnkpm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdubmxrZWd3dW55a2RzaGRua3BtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1ODE3MzEsImV4cCI6MjA4ODE1NzczMX0.283Q7OUG6AS_kcWh2vnQdES_t0mm4uVvswvbu02f3V0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

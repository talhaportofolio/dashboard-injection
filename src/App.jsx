import React, { useState, useEffect } from 'react';
import { 
  Activity, PowerOff, Clock, AlertCircle, Wifi, 
  Cpu, XCircle, Info, Factory, Radio 
} from 'lucide-react';

const MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';

// Definisikan kedua topik agar sesuai dengan kode ESP32
const TOPIC_M1 = 'pabrik/mesin_injection_1/status';
const TOPIC_M2 = 'pabrik/mesin_injection_2/status';

export default function App() {
  const [connectStatus, setConnectStatus] = useState('Menghubungkan...');
  
  // Memisahkan state untuk Mesin 1 dan Mesin 2
  const [machine1, setMachine1] = useState({ status_mesin: "TIDAK DIKETAHUI", lastUpdate: null });
  const [machine2, setMachine2] = useState({ status_mesin: "TIDAK DIKETAHUI", lastUpdate: null });

  useEffect(() => {
    let mqttClient = null;
    let isMounted = true;
    let simInterval = null;

    const initMqtt = () => {
      if (!window.mqtt || !isMounted) return;

      const isCanvas = window.self !== window.top;

      if (!isCanvas) {
        try {
          mqttClient = window.mqtt.connect(MQTT_BROKER, {
            clientId: `web_client_inj_${Math.random().toString(16).slice(2, 10)}`,
            keepalive: 60,
            clean: true,
            reconnectPeriod: 5000,
          });

          mqttClient.on('connect', () => {
            setConnectStatus('Terhubung');
            mqttClient.subscribe(TOPIC_M1);
            mqttClient.subscribe(TOPIC_M2);
          });

          mqttClient.on('reconnect', () => setConnectStatus('Menghubungkan ulang...'));
          mqttClient.on('error', () => setConnectStatus('Koneksi Error'));
          mqttClient.on('offline', () => setConnectStatus('Offline'));

          mqttClient.on('message', (topic, message) => {
            try {
              const payload = JSON.parse(message.toString());
              const timeNow = new Date().toLocaleTimeString('id-ID', { hour12: false });
              
              if (topic === TOPIC_M1) {
                setMachine1({ status_mesin: payload.status_mesin, lastUpdate: timeNow });
              } else if (topic === TOPIC_M2) {
                setMachine2({ status_mesin: payload.status_mesin, lastUpdate: timeNow });
              }
            } catch (error) {
              console.error("Invalid JSON:", error);
            }
          });
        } catch (error) {
          console.error("Gagal melakukan inisiasi MQTT:", error);
        }
      } else {
        // Mode Simulasi Canvas
        console.warn("Koneksi WebSocket diblokir oleh lingkungan Canvas. Memulai Mode Simulasi.");
        setConnectStatus('Mode Simulasi');
        
        const statuses = ['RUNNING', 'STAND BY', 'MATI'];
        const initialTime = new Date().toLocaleTimeString('id-ID', { hour12: false });
        
        setMachine1({ status_mesin: 'RUNNING', lastUpdate: initialTime });
        setMachine2({ status_mesin: 'STAND BY', lastUpdate: initialTime });

        simInterval = setInterval(() => {
          if (!isMounted) return;
          const timeNow = new Date().toLocaleTimeString('id-ID', { hour12: false });
          
          if (Math.random() > 0.4) {
            setMachine1({ status_mesin: statuses[Math.floor(Math.random() * statuses.length)], lastUpdate: timeNow });
          }
          if (Math.random() > 0.4) {
            setMachine2({ status_mesin: statuses[Math.floor(Math.random() * statuses.length)], lastUpdate: timeNow });
          }
        }, 5000);
      }
    };

    if (!window.mqtt) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mqtt/5.3.5/mqtt.min.js';
      script.async = true;
      script.onload = initMqtt;
      document.body.appendChild(script);
    } else {
      initMqtt();
    }

    return () => {
      isMounted = false;
      if (mqttClient) mqttClient.end();
      if (simInterval) clearInterval(simInterval);
    };
  }, []);

  const getTheme = (status) => {
    switch (status) {
      case 'RUNNING':
        return {
          bg: 'bg-emerald-50', ring: 'ring-emerald-500/20', text: 'text-emerald-600',
          border: 'border-emerald-100', dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
          icon: <Activity className="w-16 h-16 text-emerald-500 animate-pulse" />,
          desc: 'Mesin menyala, beroperasi normal, dan sedang produksi.'
        };
      case 'STAND BY':
        return {
          bg: 'bg-amber-50', ring: 'ring-amber-500/20', text: 'text-amber-600',
          border: 'border-amber-100', dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
          icon: <Clock className="w-16 h-16 text-amber-500" />,
          desc: 'Mesin menyala namun sedang menunggu proses produksi.'
        };
      case 'MATI':
        return {
          bg: 'bg-rose-50', ring: 'ring-rose-500/20', text: 'text-rose-600',
          border: 'border-rose-100', dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]',
          icon: <PowerOff className="w-16 h-16 text-rose-500" />,
          desc: 'Daya utama mesin dimatikan.'
        };
      default:
        return {
          bg: 'bg-slate-50', ring: 'ring-slate-500/20', text: 'text-slate-500',
          border: 'border-slate-200', dot: 'bg-slate-400',
          icon: <AlertCircle className="w-16 h-16 text-slate-400" />,
          desc: 'Koneksi terputus. Data mesin tidak diketahui saat ini.'
        };
    }
  };

  const MachineCard = ({ title, data }) => {
    const theme = getTheme(data.status_mesin);

    return (
      <div className={`relative bg-white rounded-3xl shadow-sm hover:shadow-md border border-gray-100 overflow-hidden ring-4 ${theme.ring} transition-all duration-500 hover:-translate-y-1`}>
        
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-50 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 tracking-wider uppercase">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {connectStatus === 'Terhubung' ? (
              <Wifi className="w-4 h-4 text-emerald-500 animate-pulse" />
            ) : connectStatus === 'Mode Simulasi' ? (
              <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400" />
            )}
            <span className="text-[10px] font-medium uppercase text-gray-400 tracking-wider">{connectStatus}</span>
          </div>
        </div>

        <div className="p-8 flex flex-col items-center text-center">
          <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 transition-colors duration-500 ${theme.bg}`}>
            {theme.icon}
          </div>
          
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Status Saat Ini</h2>
          <div className={`text-4xl font-black tracking-tight mb-3 ${theme.text}`}>
            {data.status_mesin}
          </div>
          <p className="text-sm text-gray-500 max-w-[250px] leading-relaxed">
            {theme.desc}
          </p>
        </div>

        <div className="bg-gray-50/80 px-6 py-4 flex justify-between items-center border-t border-gray-100">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Update Terakhir:</span>
          <span className="text-sm font-semibold text-gray-700 bg-white px-3 py-1 rounded-lg shadow-sm border border-gray-100">
            {data.lastUpdate || '--:--:--'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 font-sans text-gray-800 selection:bg-blue-100">
      <div className="w-full max-w-5xl py-6 md:py-10">
        
        {/* HEADER BARU: Desain Mengikuti Tema OT Group (Navy & Gold) */}
        <div className="flex flex-col md:flex-row items-center justify-between bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mb-10 transition-all hover:shadow-md relative overflow-hidden">
          
          {/* Efek Garis Atas (Aksen Gold & Navy OT Group) */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#19325B] via-[#F29D21] to-[#19325B]"></div>

          <div className="flex items-center flex-col md:flex-row text-center md:text-left gap-5 mb-5 md:mb-0 mt-3 md:mt-0">
            {/* Tempat Logo Asli OT Group */}
            <div className="w-16 h-16 flex items-center justify-center p-1 bg-white rounded-xl shadow-sm border border-slate-100">
              {/* Memanggil logo-ot.png dari folder public Anda */}
              <img 
                src="/logo-ot.png" 
                alt="OT Group Logo" 
                className="w-full h-full object-contain drop-shadow-sm"
                onError={(e) => {
                  // Fallback: Jika gambar gagal diload, akan memunculkan ikon pengganti
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              {/* Ikon Pengganti (Hanya muncul jika file logo-ot.png tidak ditemukan) */}
              <div className="hidden w-12 h-12 bg-[#19325B] rounded-lg flex-col items-center justify-center relative overflow-hidden">
                 <div className="absolute -right-2 -top-2 w-6 h-6 bg-[#F29D21] rounded-full opacity-80"></div>
                 <Factory className="w-6 h-6 text-white relative z-10" />
              </div>
            </div>
            
            {/* Teks Header */}
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-[#19325B] tracking-tight mb-1 drop-shadow-sm">
                PT. Ultra Prima Abadi
              </h1>
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="w-2 h-2 rounded-full bg-[#F29D21] shadow-[0_0_5px_rgba(242,157,33,0.8)]"></span>
                <p className="text-sm font-bold text-slate-500 tracking-widest uppercase">
                  Monitoring Mesin Injection
                </p>
              </div>
            </div>
          </div>

          {/* Badge Live Status */}
          <div className="flex items-center gap-3 bg-slate-50 px-5 py-2.5 rounded-full border border-slate-200 shadow-sm mt-1 md:mt-0">
             <Radio className="w-4 h-4 text-[#F29D21] animate-pulse" />
             <span className="text-xs font-extrabold uppercase tracking-widest text-[#19325B]">
               Live System
             </span>
             <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
          </div>
        </div>

        {/* KARTU MESIN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <MachineCard title="Woojin-39" data={machine1} />
          <MachineCard title="Woojin-41" data={machine2} />
        </div>

        {/* PANDUAN STATUS BARU: Desain Dashboard Modern */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
          
          {/* Header Panduan */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-50">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Info className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-sm font-bold tracking-widest text-gray-800 uppercase">Panduan Indikator Status</h3>
          </div>
          
          {/* Grid 4 Kotak Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Kartu Status RUNNING */}
            <div className="group relative overflow-hidden bg-slate-50/50 p-5 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">Running</span>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
              </div>
              <p className="text-xs leading-relaxed text-gray-500 font-medium">
                Mesin menyala, beroperasi normal, dan sedang produksi.
              </p>
            </div>

            {/* Kartu Status STAND BY */}
            <div className="group relative overflow-hidden bg-slate-50/50 p-5 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black text-amber-700 uppercase tracking-widest">Stand By</span>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
              </div>
              <p className="text-xs leading-relaxed text-gray-500 font-medium">
                Mesin menyala namun sedang menunggu proses produksi.
              </p>
            </div>

            {/* Kartu Status MATI */}
            <div className="group relative overflow-hidden bg-slate-50/50 p-5 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black text-rose-700 uppercase tracking-widest">Mati</span>
                <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
              </div>
              <p className="text-xs leading-relaxed text-gray-500 font-medium">
                Daya utama mesin dimatikan.
              </p>
            </div>

            {/* Kartu Status OFFLINE */}
            <div className="group relative overflow-hidden bg-slate-50/50 p-5 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all duration-300">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-400"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Offline</span>
                <div className="w-2 h-2 rounded-full bg-slate-400"></div>
              </div>
              <p className="text-xs leading-relaxed text-gray-500 font-medium">
                Koneksi terputus. Data mesin tidak diketahui saat ini.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>       
  );
}

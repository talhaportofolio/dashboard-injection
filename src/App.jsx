import React, { useState, useEffect } from 'react';
import { Activity, PowerOff, Clock, AlertCircle, Wifi, Cpu, XCircle } from 'lucide-react';

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

      // Cek apakah kode sedang berjalan di dalam iframe/Canvas platform ini
      const isCanvas = window.self !== window.top;

      if (!isCanvas) {
        // JIKA BERJALAN DI LAPTOP LOKAL ATAU HOSTING (Bukan di Canvas)
        try {
          mqttClient = window.mqtt.connect(MQTT_BROKER, {
            clientId: `web_client_inj_${Math.random().toString(16).slice(2, 10)}`,
            keepalive: 60,
            clean: true,
            reconnectPeriod: 5000,
          });

          mqttClient.on('connect', () => {
            setConnectStatus('Terhubung');
            // Subscribe ke kedua mesin sekaligus
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
              
              // Logika pembagian jalur data: Cek dari topik mana data ini berasal
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
        // JIKA BERJALAN DI CANVAS (Menghindari SecurityError pemblokiran WebSocket)
        console.warn("Koneksi WebSocket diblokir oleh lingkungan Canvas. Memulai Mode Simulasi.");
        setConnectStatus('Mode Simulasi');
        
        const statuses = ['RUNNING', 'STAND BY', 'MATI'];
        const initialTime = new Date().toLocaleTimeString('id-ID', { hour12: false });
        
        // Berikan status awal untuk simulasi
        setMachine1({ status_mesin: 'RUNNING', lastUpdate: initialTime });
        setMachine2({ status_mesin: 'STAND BY', lastUpdate: initialTime });

        // Update status secara acak setiap 5 detik agar UI terlihat hidup di Canvas
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
          icon: <Activity className="w-16 h-16 text-emerald-500 animate-pulse" />,
          desc: 'Mesin beroperasi dan sedang produksi.'
        };
      case 'STAND BY':
        return {
          bg: 'bg-amber-50', ring: 'ring-amber-500/20', text: 'text-amber-600',
          icon: <Clock className="w-16 h-16 text-amber-500" />,
          desc: 'Mesin menyala, menunggu proses produksi.'
        };
      case 'MATI':
        return {
          bg: 'bg-rose-50', ring: 'ring-rose-500/20', text: 'text-rose-600',
          icon: <PowerOff className="w-16 h-16 text-rose-500" />,
          desc: 'Daya utama mesin dimatikan.'
        };
      default:
        return {
          bg: 'bg-slate-50', ring: 'ring-slate-500/20', text: 'text-slate-500',
          icon: <AlertCircle className="w-16 h-16 text-slate-400" />,
          desc: 'Menunggu pembaruan data dari panel...'
        };
    }
  };

  // --- SUB-KOMPONEN KARTU MESIN ---
  // Agar kode tidak diulang-ulang, kita buat "cetakan" kartunya di sini
  const MachineCard = ({ title, data }) => {
    const theme = getTheme(data.status_mesin);

    return (
      <div className={`relative bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden ring-4 ${theme.ring} transition-all duration-500`}>
        
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-50 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 tracking-wider">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {connectStatus === 'Terhubung' ? (
              <Wifi className="w-4 h-4 text-emerald-500 animate-pulse" />
            ) : connectStatus === 'Mode Simulasi' ? (
              <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400" />
            )}
            <span className="text-[10px] font-medium uppercase text-gray-400">{connectStatus}</span>
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
          <span className="text-xs font-medium text-gray-400">Update Terakhir:</span>
          <span className="text-sm font-semibold text-gray-700 bg-white px-3 py-1 rounded-md shadow-sm border border-gray-100">
            {data.lastUpdate || '--:--:--'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans text-gray-800">
      <div className="w-full max-w-4xl">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">PT. Ultra Prima Abadi - Jakarta</h1>
          <p className="text-sm text-gray-500 mt-1">Monitoring Mesin Injection</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <MachineCard title="Wujin-39" data={machine1} />
          <MachineCard title="Wujin-41" data={machine2} />
        </div>
      </div>
    </div>       
  );
}

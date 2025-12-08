'use client'

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trash2, RotateCcw, Stethoscope, History, Home, Moon, Sun, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import LogoScroll from './components/LogoScroll';

// --- TIPE DATA ---
type Symptom = string;

type ResultItem = {
  id: number;
  nama_rule: string;
  solusi: string;
  cf_percentage: number;
  matching_symptoms: number;
  total_symptoms: number;
};

type Diagnosis = {
  id: number;
  timestamp: string;
  symptoms: Symptom[];
  results: ResultItem[];
};

// --- DATA RULES DENGAN BOBOT (HYBRID LOGIC) ---
// Bobot (cf) menentukan seberapa "kuat" gejala tersebut menunjuk ke kerusakan.
// Nilai 1.0 atau 0.95 berarti gejala itu SANGAT KHAS (bisa langsung vonis 100%).
const RULES_DATA = [
  {
    id: 1,
    nama_rule: "Power Supply (PSU) Bermasalah",
    gejala: [
      { nama: "Indikator lampu Power mati total", cf: 0.95 }, // Khas
      { nama: "Kipas Power Supply tidak berputar", cf: 0.95 }, // Khas
      { nama: "Komputer mati total tidak ada respon", cf: 0.8 },
      { nama: "Sering mati mendadak saat beban berat", cf: 0.6 },
      { nama: "Sudah ganti kabel power tetap mati", cf: 0.7 }
    ],
    solusi: "Cek kabel power. Tes PSU dengan jumper (kabel hijau+hitam). Jika kipas PSU mati, ganti PSU. Periksa kapasitor PSU.",
  },
  {
    id: 2,
    nama_rule: "RAM (Memory) Rusak",
    gejala: [
      { nama: "Bunyi beep panjang berulang (biasanya 3x)", cf: 0.99 }, // Sangat Khas RAM
      { nama: "Blue Screen (BSOD) 'Memory Management'", cf: 0.9 },
      { nama: "Gagal saat instalasi Windows (File Corrupt)", cf: 0.7 },
      { nama: "Layar No Display tapi kipas menyala", cf: 0.6 }, 
      { nama: "Komputer sering Restart sendiri", cf: 0.5 } 
    ],
    solusi: "Bersihkan pin kuningan RAM dengan penghapus karet. Coba pindah slot RAM. Tes RAM satu per satu jika ada lebih dari satu keping.",
  },
  {
    id: 3,
    nama_rule: "Hard Disk / SSD Bermasalah",
    gejala: [
      { nama: "Bunyi fisik 'tek-tek' atau 'klik' dari casing", cf: 0.99 }, // Sangat Khas HDD
      { nama: "Pesan error 'Disk Boot Failure' / 'No Bootable Device'", cf: 0.9 },
      { nama: "Proses booting Windows sangat lambat", cf: 0.6 },
      { nama: "Sering macet/freeze saat buka Explorer", cf: 0.6 },
      { nama: "Data sering rusak atau hilang sendiri", cf: 0.7 }
    ],
    solusi: "Segera backup data! Cek kesehatan disk dengan HDTune/Sentinel. Ganti kabel SATA atau ganti SSD secepatnya.",
  },
  {
    id: 4,
    nama_rule: "Processor Overheat",
    gejala: [
      { nama: "Suhu CPU di BIOS/Software > 85°C", cf: 1.0 }, // Pasti overheat
      { nama: "Kipas prosesor berbunyi sangat bising", cf: 0.8 },
      { nama: "Casing area prosesor sangat panas disentuh", cf: 0.7 },
      { nama: "Komputer melambat (throttling) setelah lama dipakai", cf: 0.6 },
      { nama: "Komputer mati mendadak saat main game", cf: 0.6 }
    ],
    solusi: "Bersihkan debu heatsink. Ganti Thermal Paste prosesor. Pastikan sirkulasi udara casing bagus. Cek putaran fan CPU.",
  },
  {
    id: 5,
    nama_rule: "VGA Card / GPU Rusak",
    gejala: [
      { nama: "Layar pecah-pecah / garis-garis (Artefak)", cf: 0.99 }, // Sangat Khas VGA
      { nama: "Resolusi layar tertahan kecil & tidak bisa diubah", cf: 0.8 },
      { nama: "Driver VGA sering crash / has stopped working", cf: 0.8 },
      { nama: "Game sering keluar sendiri (Force Close)", cf: 0.5 },
      { nama: "Layar blank hitam tapi suara Windows ada", cf: 0.7 }
    ],
    solusi: "Reseat (lepas-pasang) VGA. Bersihkan slot PCIe. Coba driver versi lain. Cek suhu VGA. Tes VGA di PC lain.",
  },
  {
    id: 6,
    nama_rule: "Motherboard Bermasalah",
    gejala: [
      { nama: "Fisik kapasitor terlihat kembung/bocor", cf: 0.99 }, // Sangat Khas
      { nama: "Jam BIOS selalu reset (baterai baru)", cf: 0.8 },
      { nama: "Port USB/Audio belakang mati sebagian", cf: 0.8 },
      { nama: "Komputer nyala tapi tidak masuk BIOS (No POST)", cf: 0.6 },
      { nama: "Sering Hang/Freeze total saat diam (Idle)", cf: 0.5 }
    ],
    solusi: "Reset BIOS (Clear CMOS). Cek fisik motherboard. Jika kerusakan parah pada chipset, disarankan ganti motherboard.",
  }
];

// --- LOGIC CERTAINTY FACTOR ---
// Rumus: CF_Baru = CF_Lama + CF_Gejala * (1 - CF_Lama)
const cfCombine = (cfOld: number, cfGejala: number): number => {
  return cfOld + cfGejala * (1 - cfOld);
};

const calculateDiagnosis = (selectedSymptoms: Symptom[]) => {
  const results: ResultItem[] = [];
  
  RULES_DATA.forEach(rule => {
    // Filter gejala yang dipilih user DAN ada di rule ini
    const matchingSymptoms = rule.gejala.filter(g => 
      selectedSymptoms.includes(g.nama)
    );
    
    if (matchingSymptoms.length > 0) {
      let cfCombined = 0; // Nilai awal
      
      // Proses kombinasi CF
      matchingSymptoms.forEach((gejala, index) => {
        if (index === 0) {
          cfCombined = gejala.cf; 
        } else {
          cfCombined = cfCombine(cfCombined, gejala.cf); 
        }
      });
      
      results.push({
        id: rule.id,
        nama_rule: rule.nama_rule,
        solusi: rule.solusi,
        // Pembulatan ke persen
        cf_percentage: Math.round(cfCombined * 100), 
        matching_symptoms: matchingSymptoms.length,
        total_symptoms: rule.gejala.length
      });
    }
  });
  
  return results.sort((a, b) => b.cf_percentage - a.cf_percentage);
};

const getAllSymptoms = (): Symptom[] => {
  const symptoms = new Set<string>();
  RULES_DATA.forEach(rule => {
    rule.gejala.forEach(g => symptoms.add(g.nama));
  });
  return Array.from(symptoms).sort();
};

// --- KOMPONEN UTAMA ---
function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [diagnosisResult, setDiagnosisResult] = useState<Diagnosis | null>(null);
  const [history, setHistory] = useState<Diagnosis[]>([]);
  const [allSymptoms] = useState(getAllSymptoms());
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLandingPage, setLandingPage] = useState(true);
  
  // State untuk Modal Konfirmasi Hapus
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const savedHistory = localStorage.getItem('diagnosis_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
    } else if (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  const handleSymptomToggle = (symptom: Symptom) => {
    setSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleDiagnose = () => {
    if (symptoms.length === 0) {
      alert('Pilih minimal 1 gejala untuk diagnosa');
      return;
    }

    const results = calculateDiagnosis(symptoms);
    const diagnosis: Diagnosis = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      symptoms: [...symptoms],
      results
    };

    setDiagnosisResult(diagnosis);

    const newHistory = [diagnosis, ...history].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('diagnosis_history', JSON.stringify(newHistory));
  };

  const handleReset = () => {
    setSymptoms([]);
    setDiagnosisResult(null);
  };

  // Logic Hapus History
  const handleClearHistoryClick = () => setShowModal(true);
  const confirmDeleteHistory = () => {
    setHistory([]);
    localStorage.removeItem('diagnosis_history');
    setShowModal(false);
  };

  // --- RENDER HALAMAN ---
  const renderHome = () => (
    <div className="space-y-6">
      <div className="bg-linear-to-b from-gray-50 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-7 text-gray-900 dark:text-gray-100 shadow-lg">
        <h1 className="flex gap-2 items-center text-2xl sm:text-3xl font-bold mb-2 tracking-tight">
          <Image src="/logo.png" alt="logo" width={50} height={50} className="w-12 h-auto invert-0 dark:invert" /> 
          Dawg Diag
        </h1>
        <p className="text-gray-900 dark:text-gray-100 text-sm">Pilih gejala yang dialami. Satu gejala spesifik cukup untuk deteksi awal.</p>
      </div>

      {/* LIST GEJALA */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <h2 className="text-xl font-semibold mb-5 flex items-center gap-4 text-gray-800 dark:text-gray-100">
          <Stethoscope className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          Daftar Gejala:
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {allSymptoms.map(symptom => (
            <label
              key={symptom}
              className={`
                flex items-start gap-3 p-4 border rounded-xl transition cursor-pointer shadow-sm hover:shadow-md 
                ${symptoms.includes(symptom)
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-500'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/50 hover:border-indigo-500 dark:hover:border-indigo-400'}
              `}
            >
              <input
                type="checkbox"
                checked={symptoms.includes(symptom)}
                onChange={() => handleSymptomToggle(symptom)}
                className="mt-1 w-5 h-5 accent-indigo-600 rounded focus:ring-indigo-500 flex-shrink-0"
              />
              <span className={`text-sm sm:text-base font-medium leading-tight ${symptoms.includes(symptom) ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
                {symptom}
              </span>
            </label>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-4 mt-8">
          <button
            onClick={handleDiagnose}
            disabled={symptoms.length === 0}
            className="flex-1 py-3 rounded-xl font-semibold text-gray-100 bg-linear-to-r from-indigo-600 to-purple-600 shadow-md hover:shadow-lg hover:brightness-110 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Diagnosa Sekarang
          </button>

          <button
            onClick={handleReset}
            className="px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-600 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-[0.97] transition flex items-center justify-center gap-2 text-gray-700 dark:text-gray-200"
          >
            <RotateCcw className="w-5 h-5" />
            Reset
          </button>
        </div>
      </div>

      {/* HASIL DIAGNOSA */}
      {diagnosisResult && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 border border-gray-100 dark:border-gray-700 animate-fadeIn transition-colors duration-300 scroll-mt-20" id="result-section">
          <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span className="text-2xl">📊</span> Hasil Analisis
          </h2>

          {diagnosisResult.results.length > 0 ? (
            <>
              <div className="mb-8 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={diagnosisResult.results} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="nama_rule" type="category" width={10} tick={{fill: 'transparent'}} /> 
                    <Tooltip 
                      cursor={{fill: isDarkMode ? '#374151' : '#f3f4f6', opacity: 0.4}}
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#1f2937' : '#fff', 
                        borderColor: isDarkMode ? '#374151' : '#e5e7eb',
                        color: isDarkMode ? '#fff' : '#000',
                        borderRadius: '12px'
                      }} 
                    />
                    <Bar dataKey="cf_percentage" fill="#6366f1" name="Kepastian (%)" radius={[0, 6, 6, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-4">
                {diagnosisResult.results.map((result, index) => (
                  <div
                    key={result.id}
                    className={`border-l-4 p-5 rounded-r-xl shadow-sm transition-all ${index === 0 ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 ring-1 ring-indigo-200 dark:ring-indigo-800' : 'border-gray-300 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 opacity-80 hover:opacity-100'}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                          {index + 1}. {result.nama_rule}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Cocok {result.matching_symptoms} dari {result.total_symptoms} gejala
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold shadow-sm ${result.cf_percentage >= 80 ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>
                        {result.cf_percentage}%
                      </span>
                    </div>
                    <div className="bg-white/50 dark:bg-black/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-500/20">
                      <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                        <strong className="text-indigo-600 dark:text-indigo-400 block mb-1">Solusi Perbaikan:</strong> 
                        {result.solusi}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-10 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
              <p className="text-gray-500 dark:text-gray-400 italic">
                Tidak ada pola kerusakan yang cocok.<br/>Coba pilih gejala lain yang lebih spesifik.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-6">
      <div className="bg-linear-to-b from-gray-50 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-lg p-6 text-gray-900 dark:text-gray-100 shadow-lg flex justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Riwayat Diagnosa</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Arsip hasil analisis sebelumnya</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={handleClearHistoryClick}
            className="bg-red-600 text-white px-4 py-2 rounded-xl font-semibold shadow hover:bg-red-700 active:scale-[0.98] transition flex items-center gap-2 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Hapus Semua
          </button>
        )}
      </div>

      {history.length > 0 ? (
        <div className="space-y-4">
          {history.map(item => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors">
              <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {new Date(item.timestamp).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • {new Date(item.timestamp).toLocaleTimeString('id-ID')}
                </p>
              </div>
              <div className="mb-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Gejala:</p>
                <div className="flex flex-wrap gap-2">
                  {item.symptoms.map((sym, idx) => (
                    <span key={idx} className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-xs border border-gray-200 dark:border-gray-600">
                      {sym}
                    </span>
                  ))}
                </div>
              </div>
              {item.results.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Hasil Teratas:</p>
                  {item.results.slice(0, 2).map((result, index) => (
                    <div key={result.id} className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                        {result.nama_rule}
                      </h4>
                      <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-xs font-bold">
                        {result.cf_percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic text-sm">Tidak ada hasil yang konklusif.</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-16 text-center border border-gray-100 dark:border-gray-700 flex flex-col items-center">
          <History className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">Belum ada riwayat tersimpan.</p>
          <button
            onClick={() => setCurrentPage('home')}
            className="mt-6 bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition shadow-lg"
          >
            Mulai Diagnosa Baru
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className={`${isDarkMode ? 'dark' : ''} overflow-x-hidden min-h-screen bg-gray-200 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans`}>
      
      {/* --- LANDING PAGE --- */}
      {isLandingPage ? (
        <div className="relative min-h-screen flex flex-col">
          <header className="h-20 w-full px-6 sm:px-20 py-6 flex justify-between items-center z-10 bg-transparent">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/logo.png" alt="logo" width={40} height={40} className="w-10 h-auto invert-0 dark:invert" />
              <h1 className="text-xl font-bold tracking-tight">Dawg Diag</h1>
            </Link>
            <div className="flex items-center gap-4">
              <button onClick={toggleTheme} className="p-2 rounded-full bg-white/20 hover:bg-white/40 dark:bg-black/20 dark:hover:bg-black/40 backdrop-blur transition" aria-label="Toggle Theme">
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <Link href="https://github.com/rzlmiooo/dawg-diag" target='_blank'>
                <Image src="/github.svg" alt="github" width={24} height={24} className="w-6 h-6 dark:invert opacity-80 hover:opacity-100 transition" />
              </Link>
            </div>
          </header>

          <main className="flex-1 flex flex-col items-center justify-center px-6 text-center z-10 pb-20">
            <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
              <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-semibold mb-2">
                🚀 Sistem Pakar Cihuy
              </div>
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
                Deteksi Kerusakan Komputer <br/>
                <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                  Cepat & Akurat
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
                Gunakan metode Certainty Factor untuk menganalisis gejala perangkat keras Anda. Dapatkan solusi perbaikan instan tanpa perlu ke teknisi.
              </p>
              <div className="pt-4">
                <button onClick={() => setLandingPage(false)} className="px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-lg font-bold rounded-full hover:scale-105 hover:shadow-2xl transition-all duration-300 flex items-center gap-2 mx-auto">
                  Mulai Diagnosa Sekarang <span className="text-xl">→</span>
                </button>
              </div>
            </div>

            <div className="mt-20 w-full max-w-5xl">
              <LogoScroll />
            </div>

            <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl w-full text-left">
              <div className="p-6 bg-white/50 dark:bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="text-3xl mb-3">👨‍💻</div>
                <h3 className="font-bold text-lg mb-1">Mohammad Syfa EC</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Frontend Developer</p>
              </div>
              <div className="p-6 bg-white/50 dark:bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="text-3xl mb-3">🛠️</div>
                <h3 className="font-bold text-lg mb-1">Rizal Maulana</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Backend Developer</p>
              </div>
              <div className="p-6 bg-white/50 dark:bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="text-3xl mb-3">🎨</div>
                <h3 className="font-bold text-lg mb-1">Varid Firmansyah</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">UI/UX Designer</p>
              </div>
            </div>
          </main>

          <footer className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            &copy; 2025 Dawg Diag Team. All rights reserved.
          </footer>
        </div>
      ) : (
        // --- APP MODE ---
        <div className="min-h-screen flex flex-col">
          <nav className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-50 border-b dark:border-gray-700 transition-colors">
            <div className="max-w-5xl mx-auto px-4 py-3">
              <div className="flex justify-between items-center">
                <div className="flex gap-2 sm:gap-4">
                  {/* TOMBOL BACK KE HOME */}
                  <button
                    onClick={() => setLandingPage(true)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                    aria-label="Kembali ke Home"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setCurrentPage('home')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                      currentPage === 'home'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Home className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">Diagnosa</span>
                  </button>

                  <button
                    onClick={() => setCurrentPage('history')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                      currentPage === 'history'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <History className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">Riwayat</span>
                    {history.length > 0 && (
                      <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full ml-1">
                        {history.length}
                      </span>
                    )}
                  </button>
                </div>

                <button onClick={toggleTheme} className="p-2.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </nav>

          <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
            {currentPage === 'home' ? renderHome() : renderHistory()}
          </main>

          <footer className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 py-8 transition-colors text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Copyright &copy; 2025. Rizal, Syfa, dan Varid.
            </p>
          </footer>
        </div>
      )}

      {/* === MODAL CONFIRMATION === */}
      {showModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-200 dark:border-gray-700 transform scale-100 transition-all">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-500">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Hapus Semua Riwayat?</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Tindakan ini tidak dapat dibatalkan. Semua data diagnosa lama akan hilang permanen.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-lg font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition">Batal</button>
              <button onClick={confirmDeleteHistory} className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/30 transition">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
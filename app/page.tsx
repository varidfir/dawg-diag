'use client'

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trash2, RotateCcw, Stethoscope, History, Home, Moon, Sun, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import LogoScroll from './components/LogoScroll';

// --- TIPE DATA ---
// Kita ubah struktur gejala user, bukan cuma string, tapi simpan nilai CF user-nya
type UserSymptomSelection = {
  [symptomName: string]: number; // key: nama gejala, value: cf user (0.4 - 1.0)
};

type RuleSymptom = {
  nama: string;
  cf: number; // CF Pakar
};

type ResultItem = {
  id: number;
  nama_rule: string;
  solusi: string;
  cf_score: number; // Nilai asli 0-1 untuk sorting
  cf_label: string; // Label (Sangat Yakin, dll)
  matching_symptoms: number;
  total_symptoms: number;
};

type Diagnosis = {
  id: number;
  timestamp: string;
  symptoms: string[]; // Simpan nama gejalanya saja untuk history
  results: ResultItem[];
};

// --- KONSTANTA PILIHAN KEYAKINAN USER ---
const USER_CONFIDENCE_OPTIONS = [
  { label: "Sangat Yakin", value: 1.0, color: "bg-indigo-600 text-white border-indigo-600" },
  { label: "Yakin", value: 0.8, color: "bg-blue-500 text-white border-blue-500" },
  { label: "Cukup Yakin", value: 0.6, color: "bg-teal-500 text-white border-teal-500" },
  { label: "Sedikit Ragu", value: 0.4, color: "bg-gray-400 text-white border-gray-400" }
];

// --- HELPER LABEL HASIL (PENGGANTI PERSENTASE) ---
const getConfidenceLabel = (cf: number): string => {
  if (cf >= 0.8) return "Sangat Yakin (Pasti)";
  if (cf >= 0.6) return "Yakin (Kemungkinan Besar)";
  if (cf >= 0.4) return "Cukup Yakin (Ada Potensi)";
  return "Kurang Yakin (Kemungkinan Kecil)";
};

// --- DATA RULES (3 GEJALA PER DIAGNOSA) ---
const RULES_DATA = [
  {
    id: 1,
    nama_rule: "Power Supply (PSU) Rusak",
    gejala: [
      { nama: "Komputer mati total (Tidak ada respon sama sekali)", cf: 0.9 },
      { nama: "Kipas Power Supply tidak berputar", cf: 0.9 },
      { nama: "Indikator lampu di casing/motherboard mati total", cf: 0.8 }
    ],
    solusi: "Periksa kabel power. Tes PSU dengan jumper (kabel hijau+hitam). Jika kipas PSU mati, segera ganti PSU baru.",
  },
  {
    id: 2,
    nama_rule: "RAM (Memory) Rusak",
    gejala: [
      { nama: "Bunyi beep panjang berulang (biasanya 3x)", cf: 0.95 },
      { nama: "Layar tidak tampil (No Display) tapi kipas menyala", cf: 0.7 },
      { nama: "Blue Screen (BSOD) saat pemakaian berat", cf: 0.8 }
    ],
    solusi: "Bersihkan pin kuningan RAM dengan penghapus karet. Coba pindah slot RAM. Tes RAM satu per satu.",
  },
  {
    id: 3,
    nama_rule: "Hard Disk / SSD Bermasalah",
    gejala: [
      { nama: "Bunyi fisik 'tek-tek' atau 'klik' dari casing", cf: 0.95 },
      { nama: "Proses booting Windows sangat lambat/gagal boot", cf: 0.8 },
      { nama: "File sering corrupt atau hilang sendiri", cf: 0.7 }
    ],
    solusi: "Segera backup data! Cek kesehatan disk dengan HDTune/Sentinel. Ganti kabel SATA atau ganti ke SSD.",
  },
  {
    id: 4,
    nama_rule: "Processor Overheat",
    gejala: [
      { nama: "Komputer mati mendadak saat main game/aplikasi berat", cf: 0.9 },
      { nama: "Kipas prosesor berbunyi sangat bising/kencang", cf: 0.7 },
      { nama: "Suhu CPU terdeteksi tinggi (>80°C) di BIOS", cf: 1.0 }
    ],
    solusi: "Bersihkan debu heatsink. Ganti Thermal Paste prosesor. Pastikan sirkulasi udara casing lancar.",
  },
  {
    id: 5,
    nama_rule: "VGA Card / GPU Rusak",
    gejala: [
      { nama: "Tampilan layar pecah/garis-garis (Artefak)", cf: 0.95 },
      { nama: "Resolusi layar kecil & tidak bisa diubah", cf: 0.8 },
      { nama: "Driver VGA sering crash/error", cf: 0.7 }
    ],
    solusi: "Reseat (lepas-pasang) VGA. Bersihkan slot PCIe. Coba driver versi lain. Cek suhu VGA.",
  },
  {
    id: 6,
    nama_rule: "Motherboard Bermasalah",
    gejala: [
      { nama: "Fisik kapasitor terlihat kembung/bocor", cf: 0.95 },
      { nama: "Jam BIOS selalu reset ke tahun lama", cf: 0.8 },
      { nama: "Port USB/Audio belakang tidak berfungsi", cf: 0.7 }
    ],
    solusi: "Reset BIOS (Clear CMOS). Cek fisik motherboard. Jika kerusakan parah, ganti motherboard.",
  }
];

// --- LOGIC CERTAINTY FACTOR ---
const cfCombine = (cfOld: number, cfGejala: number): number => {
  return cfOld + cfGejala * (1 - cfOld);
};

// --- MENGAMBIL LIST GEJALA UNIK ---
const getAllSymptoms = (): string[] => {
  const symptoms = new Set<string>();
  RULES_DATA.forEach(rule => {
    rule.gejala.forEach(g => symptoms.add(g.nama));
  });
  return Array.from(symptoms).sort();
};

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  // State berubah: bukan array string, tapi object { "Gejala A": 0.8, "Gejala B": 0.4 }
  const [userSelection, setUserSelection] = useState<UserSymptomSelection>({});
  
  const [diagnosisResult, setDiagnosisResult] = useState<Diagnosis | null>(null);
  const [history, setHistory] = useState<Diagnosis[]>([]);
  const [allSymptoms] = useState(getAllSymptoms());
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLandingPage, setLandingPage] = useState(true);
  
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

  // --- LOGIC MEMILIH GEJALA DAN BOBOT ---
  const handleSymptomClick = (symptomName: string) => {
    // Jika sudah ada, hapus (toggle off)
    if (userSelection[symptomName]) {
      const newSelection = { ...userSelection };
      delete newSelection[symptomName];
      setUserSelection(newSelection);
    } else {
      // Jika belum ada, tambahkan dengan nilai default (misal 0.8 - Yakin)
      setUserSelection(prev => ({ ...prev, [symptomName]: 0.8 }));
    }
  };

  const handleConfidenceChange = (symptomName: string, value: number) => {
    setUserSelection(prev => ({ ...prev, [symptomName]: value }));
  };

  // --- LOGIC DIAGNOSA ---
  const handleDiagnose = () => {
    if (Object.keys(userSelection).length === 0) {
      alert('Pilih minimal 1 gejala untuk diagnosa');
      return;
    }

    const results: ResultItem[] = [];

    RULES_DATA.forEach(rule => {
      // Cari gejala di rule ini yang dipilih user
      const matchingUserSymptoms = rule.gejala.filter(g => userSelection[g.nama] !== undefined);

      if (matchingUserSymptoms.length > 0) {
        let cfCombined = 0;

        matchingUserSymptoms.forEach((gejalaRule, index) => {
          // CF Gejala = CF Pakar * CF User
          const userCF = userSelection[gejalaRule.nama];
          const currentEvidenceCF = gejalaRule.cf * userCF;

          if (index === 0) {
            cfCombined = currentEvidenceCF;
          } else {
            cfCombined = cfCombine(cfCombined, currentEvidenceCF);
          }
        });

        results.push({
          id: rule.id,
          nama_rule: rule.nama_rule,
          solusi: rule.solusi,
          cf_score: cfCombined,
          cf_label: getConfidenceLabel(cfCombined),
          matching_symptoms: matchingUserSymptoms.length,
          total_symptoms: rule.gejala.length
        });
      }
    });

    // Urutkan berdasarkan score tertinggi
    results.sort((a, b) => b.cf_score - a.cf_score);

    const diagnosis: Diagnosis = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      symptoms: Object.keys(userSelection), // Simpan nama gejala saja
      results
    };

    setDiagnosisResult(diagnosis);

    const newHistory = [diagnosis, ...history].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('diagnosis_history', JSON.stringify(newHistory));
  };

  const handleReset = () => {
    setUserSelection({});
    setDiagnosisResult(null);
  };

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
        <p className="text-gray-900 dark:text-gray-100 text-sm">Silakan pilih gejala yang Anda alami dan tentukan seberapa yakin Anda dengan gejala tersebut.</p>
      </div>

      {/* LIST GEJALA DENGAN PILIHAN KEYAKINAN */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <h2 className="text-xl font-semibold mb-5 flex items-center gap-4 text-gray-800 dark:text-gray-100">
          <Stethoscope className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          Daftar Gejala & Keyakinan:
        </h2>

        <div className="grid grid-cols-1 gap-4">
          {allSymptoms.map(symptom => {
            const isSelected = userSelection[symptom] !== undefined;
            const currentVal = userSelection[symptom];

            return (
              <div 
                key={symptom}
                className={`
                  border rounded-xl p-4 transition-all duration-300
                  ${isSelected 
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-md' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'}
                `}
              >
                {/* Bagian Klik Utama */}
                <div 
                  onClick={() => handleSymptomClick(symptom)}
                  className="flex items-start gap-3 cursor-pointer"
                >
                  <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-400'}`}>
                    {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className={`text-base font-medium ${isSelected ? 'text-indigo-900 dark:text-indigo-200' : 'text-gray-700 dark:text-gray-300'}`}>
                    {symptom}
                  </span>
                </div>

                {/* Bagian Pilihan Keyakinan (Muncul Jika Dipilih) */}
                {isSelected && (
                  <div className="mt-4 pl-8 animate-fadeIn">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-semibold uppercase tracking-wide">
                      Seberapa yakin Anda mengalami gejala ini?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {USER_CONFIDENCE_OPTIONS.map((option) => (
                        <button
                          key={option.label}
                          onClick={() => handleConfidenceChange(symptom, option.value)}
                          className={`
                            px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border transition-all
                            ${currentVal === option.value 
                              ? `${option.color} shadow-sm scale-105` 
                              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}
                          `}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row gap-4 mt-8">
          <button
            onClick={handleDiagnose}
            disabled={Object.keys(userSelection).length === 0}
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

      {/* HASIL DIAGNOSA (LABEL ONLY, NO PERCENTAGE) */}
      {diagnosisResult && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 border border-gray-100 dark:border-gray-700 animate-fadeIn transition-colors duration-300 scroll-mt-20" id="result-section">
          <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span className="text-2xl">📊</span> Hasil Analisis
          </h2>

          {diagnosisResult.results.length > 0 ? (
            <>
              {/* Note: Chart dihapus/disederhanakan karena tidak pakai persentase angka */}
              <div className="space-y-6">
                {diagnosisResult.results.map((result, index) => (
                  <div
                    key={result.id}
                    className={`
                      relative overflow-hidden border-l-4 p-6 rounded-r-xl shadow-sm transition-all
                      ${index === 0 
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 ring-1 ring-indigo-200 dark:ring-indigo-800' 
                        : 'border-gray-300 bg-white dark:bg-gray-800 border-t border-r border-b border-gray-100 dark:border-gray-700'}
                    `}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
                          <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 w-6 h-6 rounded-full flex items-center justify-center text-xs">
                            {index + 1}
                          </span>
                          {result.nama_rule}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-8">
                          Berdasarkan {result.matching_symptoms} gejala yang cocok
                        </p>
                      </div>
                      
                      {/* LABEL HASIL (Bukan Persen) */}
                      <span className={`
                        px-4 py-1.5 rounded-full text-sm font-bold shadow-sm whitespace-nowrap
                        ${result.cf_score >= 0.8 ? 'bg-indigo-600 text-white' : 
                          result.cf_score >= 0.6 ? 'bg-blue-500 text-white' :
                          result.cf_score >= 0.4 ? 'bg-teal-500 text-white' :
                          'bg-gray-400 text-white'}
                      `}>
                        {result.cf_label}
                      </span>
                    </div>

                    <div className="ml-0 sm:ml-8 bg-white/60 dark:bg-black/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-500/20">
                      <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                        <strong className="text-indigo-600 dark:text-indigo-400 block mb-1 text-sm uppercase tracking-wide">
                          Solusi & Penanganan:
                        </strong> 
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
                Tidak ada pola kerusakan yang cocok.<br/>Pastikan Anda memilih gejala dengan benar.
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
                    <div key={index} className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                        {result.nama_rule}
                      </h4>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        result.cf_score >= 0.8 ? 'bg-indigo-600 text-white' : 'bg-gray-500 text-white'
                      }`}>
                        {result.cf_label}
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
      {isLandingPage == true && (
        <div className="relative min-h-screen bg-gray-200 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 text-sm">
          <header className="h-20 w-dvw px-6 sm:px-96 py-6">
            <nav className="flex justify-between items-center">
              <Link href="/" className="flex justify-center items-center gap-4 sm:gap-8">
                <Image src="/logo.png" alt="logo" width={200} height={100} className="invert-0 dark:invert w-12 h-auto" />
                <h1>Dawg Diag</h1>
              </Link>
              <div className="flex justify-center items-center gap-4 sm:gap-8">
                <button onClick={toggleTheme} className="p-2 rounded-full bg-white/20 hover:bg-white/40 dark:bg-black/20 dark:hover:bg-black/40 backdrop-blur transition" aria-label="Toggle Theme">
                  {isDarkMode ? 
                    <>
                      <Sun className="w-5 h-5" />
                      <span className="hidden sm:block">Mode Terang</span>
                    </> : 
                    <>
                      <Moon className="w-5 h-5" />
                      <span className="hidden sm:block">Mode Gelap</span>
                    </>
                  }
                </button>
                <Link href="https://github.com/rzlmiooo/dawg-diag" target='_blank'>
                  <Image src="/github.svg" alt="github" width={24} height={24} className="w-auto h-9 invert-0 dark:invert transition-all duration-300" />
                </Link>
              </div>
            </nav>
          </header>

          <main className="w-dvw h-full flex flex-col justify-center items-center">
            <div className='p-6 pb-18 px-6 sm:px-48 flex flex-col justify-center items-center'>
              <h1 className="pt-6 sm:pt-18 text-center text-xl sm:text-5xl tracking-tight leading-tight">Selamat Datang di <span className="px-3 dark:bg-gray-200 bg-gray-900 dark:text-gray-900 text-gray-100 font-semibold">Dawg Diag</span>
              </h1>
              <h2 className="text-2xl sm:text-3xl text-center pt-2 sm:pt-6">SISTEM DETEKSI DINI KERUSAKAN PADA KOMPUTER</h2>
              <p className="pt-12 text-center">Sistem ini merupakan sistem pakar untuk mendiagnosa kerusakan pada komputer, yang dirancang untuk membantu pengguna mengenali gejala kerusakan perangkat secara cepat, mudah, dan akurat. Dengan metode Forward Chaining dan Certainty Factor, sistem ini mampu memberikan kemungkinan penyebab kerusakan serta solusi penanganan yang tepat sebelum perangkat dibawa ke teknisi. Melalui antarmuka yang sederhana dan ramah pengguna, sistem ini dapat digunakan oleh siapa saja, termasuk pengguna yang tidak memiliki pengetahuan teknis mendalam mengenai komputer.</p>
              <button onClick={() => setLandingPage(false)} className="mt-8 px-3 py-2 flex w-fit dark:bg-gray-200 hover:bg-blue-500 dark:hover:bg-gray-300 bg-gray-900 dark:text-gray-900 text-gray-100 text-3xl font-semibold transition-colors duration-300">Mulai Diagnosa</button>
            </div>

            <LogoScroll />
            
            <div className="hidden sm:flex gap-1 w-dvw items-center justify-center bg-gray-200 p-0.5 text-gray-50">
              <div className="text-5xl text-gray-900 pr-6">Our <br/>Team</div>
              <ul className="bg-gray-900 px-4 py-1 text-xl">
                <li>Mohammad Syfa EC (2305101139)</li>
                <li>Rizal Maulana (2305101018)</li>
                <li>Varid Firmansyah (23051010xx)</li>
              </ul>
              <ul className="bg-gray-900 px-4 py-1 text-xl">
                <li>as Frontend Developer</li>
                <li>as Backend Developer</li>
                <li>as UI/UX Designer</li>
              </ul>
            </div>
          </main>

          <footer className="flex justify-center w-dvw py-8 text-sm">
            Copyright(C) 2025. Rizal, Syfa, dan Varid
          </footer>
        </div>
      )}

      {/* --- APP MODE --- */}
      {isLandingPage == false && (
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

      {/* === MODAL CONFIRMATION (CUSTOM BOX) === */}
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
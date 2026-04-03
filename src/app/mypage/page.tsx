'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface ReportData {
    id: string;
    date: string;
    staff: string;
    customerName: string;
    totalSales: number;
    staffShare: number;
    isPaid: boolean;
}

export default function StaffMyPage() {
    const [staffName, setStaffName] = useState(''); // メールアドレスを格納
    const [password, setPassword] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loggedInStaffName, setLoggedInStaffName] = useState(''); // 認証成功時のスタッフ名

    const [reports, setReports] = useState<ReportData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorText, setErrorText] = useState('');

    // 月選択ステート（デフォルト: 当月）
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    const printRef = useRef<HTMLDivElement>(null);
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbzhzZLoVQRSYYykqnu88ebBtx79htz-3A7YDa3RgBKbjYJ-ie308nsQXhJflpEnNfuz0g/exec';

    // 月選択肢の生成（過去12ヶ月 + 当月）
    const generateMonthOptions = () => {
        const options: { value: string; label: string }[] = [];
        const now = new Date();
        for (let i = 12; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
            options.push({ value: val, label });
        }
        return options;
    };

    // 前月・次月の移動
    const goToPrevMonth = () => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const d = new Date(y, m - 2, 1);
        setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };
    const goToNextMonth = () => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const d = new Date(y, m, 1);
        setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };

    // ログイン処理（パスワード認証後、データを取得）
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!staffName || !password) return;

        setIsLoading(true);
        setErrorText('');

        try {
            // ① パスワード認証をチェック
            const authRes = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'login', staffId: staffName, password: password })
            });
            const authJson = await authRes.json();

            if (!authJson.success) {
                setErrorText(authJson.message || 'ログインに失敗しました。');
                setIsLoading(false);
                return;
            }

            // 認証成功時にスタッフ名を保存
            const authenticatedStaffName = authJson.staffName || '';
            setLoggedInStaffName(authenticatedStaffName);

            // ② 認証成功したらデータを取得
            const res = await fetch(`${GAS_URL}?action=getReports`);
            const json = await res.json();

            if (json.success) {
                // 自分のデータだけを抽出
                const myData = json.data
                    .filter((row: any[]) => row[2] === authenticatedStaffName)
                    .map((row: any[]) => ({
                        id: row[0],
                        date: row[1],
                        staff: row[2],
                        customerName: row[4],
                        totalSales: Number(row[6]) || 0,
                        staffShare: Number(row[7]) || 0,
                        isPaid: row[8] === '入金済' || row[8] === true || row[8] === 'TRUE',
                    }))
                    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

                setReports(myData);
                setIsLoggedIn(true);
            } else {
                setErrorText('データの取得に失敗しました。');
            }
        } catch (err) {
            console.error(err);
            setErrorText('通信エラーが発生しました。ネットワークをご確認ください。');
        } finally {
            setIsLoading(false);
        }
    };

    // 印刷（PDF生成）処理
    const handlePrint = () => {
        window.print();
    };

    // 選択月のデータのみフィルタリング
    const monthReports = reports.filter(r => {
        const dateStr = String(r.date);
        // yyyy/MM/dd形式の場合は直接パース
        if (/^\d{4}\/\d{1,2}\//.test(dateStr)) {
            const parts = dateStr.split('/');
            const monthStr = `${parts[0]}-${parts[1].padStart(2, '0')}`;
            return monthStr === selectedMonth;
        }
        const d = new Date(dateStr);
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return monthStr === selectedMonth;
    });

    // 選択月の合計
    const totalMyShare = monthReports.reduce((sum, r) => sum + r.staffShare, 0);

    // 選択月の表示ラベル
    const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number);
    const monthLabel = `${selectedYear}年${selectedMonthNum}月`;

    // --- ログイン前画面 ---
    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-gray-50/50 dark:bg-gray-800/50 flex flex-col items-center pt-20 px-4">
                <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center mb-6">給与・明細の確認</h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">メールアドレス</label>
                            <input
                                type="email"
                                required
                                value={staffName}
                                onChange={(e) => setStaffName(e.target.value)}
                                placeholder="例: staff@example.com"
                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#007AFF] focus:border-transparent outline-none transition-all mb-4"
                            />

                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">パスワード</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="パスワードを入力"
                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#007AFF] focus:border-transparent outline-none transition-all"
                            />
                        </div>
                        {errorText && <p className="text-red-500 text-sm">{errorText}</p>}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-medium py-3 rounded-xl transition-all shadow-sm flex justify-center items-center"
                        >
                            {isLoading ? 'データを確認中...' : 'マイページを表示する'}
                        </button>
                    </form>
                    <div className="mt-6 text-center">
                        <Link href="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200 underline">
                            業務報告フォームへ戻る
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // --- ログイン後（マイページ＆明細書） ---
    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-gray-800/50 pt-10 pb-20 px-4 print:bg-white dark:bg-gray-800 print:pt-0 print:pb-0">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* ヘッダーボタンエリア（印刷時は完全に隠す） */}
                <div className="flex justify-between items-center print:hidden">
                    <Link href="/" className="text-sm text-[#007AFF] font-medium hover:underline">
                        ← 報告フォームに戻る
                    </Link>
                    <button
                        onClick={handlePrint}
                        className="bg-gray-900 text-white px-5 py-2 rounded-full text-sm font-medium shadow-sm hover:bg-gray-800 transition-colors"
                    >
                        明細をPDFで保存・印刷
                    </button>
                </div>

                {/* 月選択UI（印刷時は非表示） */}
                <div className="flex items-center justify-center gap-3 print:hidden">
                    <button
                        onClick={goToPrevMonth}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                    >
                        ◀
                    </button>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                    >
                        {generateMonthOptions().map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <button
                        onClick={goToNextMonth}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                    >
                        ▶
                    </button>
                </div>

                {/* --- ここから下が「明細書」として印刷（PDF化）されるエリア --- */}
                <div ref={printRef} className="bg-white dark:bg-gray-800 p-8 sm:p-12 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 print:shadow-none print:border-none print:p-0">

                    <div className="flex justify-between items-start border-b dark:border-gray-700 pb-6 mb-8">
                        <div>
                            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">給与支払明細書</h1>
                            <p className="text-gray-500 dark:text-gray-400 mt-2">ハナシタラ.com</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-500 dark:text-gray-400">発行日: {new Date().toLocaleDateString('ja-JP')}</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{staffName} <span className="text-sm font-normal text-gray-600 dark:text-gray-400">様</span></p>
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 mb-8 flex justify-between items-center print:border print:border-gray-200 dark:border-gray-700 print:bg-transparent">
                        <span className="text-lg font-medium text-gray-700 dark:text-gray-300">{monthLabel}分 合計支給額</span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">¥{totalMyShare.toLocaleString()}</span>
                    </div>

                    <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4 px-1">{monthLabel}の業務履歴・明細</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-gray-800 text-gray-900 dark:text-gray-100">
                                    <th className="py-3 px-2 font-semibold">日付</th>
                                    <th className="py-3 px-2 font-semibold">お客様名</th>
                                    <th className="py-3 px-2 font-semibold text-right">総売上</th>
                                    <th className="py-3 px-2 font-semibold text-right text-[#007AFF]">あなたの報酬額</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {monthReports.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-gray-400 dark:text-gray-500">{monthLabel}の履歴がありません</td>
                                    </tr>
                                ) : (
                                    monthReports.map((r, i) => (
                                        <tr key={i} className="text-gray-700 dark:text-gray-300 print:text-black">
                                            <td className="py-4 px-2">{String(r.date).includes('/') ? String(r.date).split(' ')[0] : new Date(r.date).toLocaleDateString('ja-JP')}</td>
                                            <td className="py-4 px-2">{r.customerName}</td>
                                            <td className="py-4 px-2 text-right">¥{r.totalSales.toLocaleString()}</td>
                                            <td className="py-4 px-2 text-right font-bold text-gray-900 dark:text-gray-100">¥{r.staffShare.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-700 text-center text-xs text-gray-400 dark:text-gray-500">
                        <p>※本明細書はシステムによって自動生成されています。</p>
                        <p className="mt-1">ハナシタラ.com サポートセンター</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

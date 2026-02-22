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
    const [staffName, setStaffName] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const [reports, setReports] = useState<ReportData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorText, setErrorText] = useState('');

    const printRef = useRef<HTMLDivElement>(null);
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbzopMne7Ga8ZruWAf3xvAP7WQFvQ-Uau09qsmG2K6-Mcs7xfrXXl1Ev4GmLHpOcgTwj/exec';

    // ログイン処理（名前を入力してデータを取得）
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!staffName) return;

        setIsLoading(true);
        setErrorText('');

        try {
            const res = await fetch(`${GAS_URL}?action=getReports`);
            const json = await res.json();

            if (json.success) {
                // 自分のデータだけを抽出
                const myData = json.data
                    .filter((row: any[]) => row[2] === staffName)
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

    // 今月の計算（※本来は月で絞り込みますが、今回は全件の合計として表示）
    const totalMyShare = reports.reduce((sum, r) => sum + r.staffShare, 0);

    // --- ログイン前画面 ---
    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-gray-50/50 flex flex-col items-center pt-20 px-4">
                <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">給与・明細の確認</h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">スタッフ名を入力してください</label>
                            <input
                                type="text"
                                required
                                value={staffName}
                                onChange={(e) => setStaffName(e.target.value)}
                                placeholder="例: テストスタッフ様"
                                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#007AFF] focus:border-transparent outline-none transition-all"
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
                        <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 underline">
                            業務報告フォームへ戻る
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // --- ログイン後（マイページ＆明細書） ---
    return (
        <div className="min-h-screen bg-gray-50/50 pt-10 pb-20 px-4 print:bg-white print:pt-0 print:pb-0">
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
                        🖨️ 明細をPDFで保存・印刷
                    </button>
                </div>

                {/* --- ここから下が「明細書」として印刷（PDF化）されるエリア --- */}
                <div ref={printRef} className="bg-white p-8 sm:p-12 rounded-2xl shadow-sm border border-gray-100 print:shadow-none print:border-none print:p-0">

                    <div className="flex justify-between items-start border-b pb-6 mb-8">
                        <div>
                            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">給与支払明細書</h1>
                            <p className="text-gray-500 mt-2">ハナシタラ.com</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-500">発行日: {new Date().toLocaleDateString('ja-JP')}</p>
                            <p className="text-xl font-bold text-gray-900 mt-1">{staffName} <span className="text-sm font-normal text-gray-600">様</span></p>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-6 mb-8 flex justify-between items-center print:border print:border-gray-200 print:bg-transparent">
                        <span className="text-lg font-medium text-gray-700">合計支給額（スタッフ報酬）</span>
                        <span className="text-3xl font-bold text-gray-900">¥{totalMyShare.toLocaleString()}</span>
                    </div>

                    <h2 className="text-sm font-bold text-gray-500 mb-4 px-1">今月の業務履歴・明細</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-gray-800 text-gray-900">
                                    <th className="py-3 px-2 font-semibold">日付</th>
                                    <th className="py-3 px-2 font-semibold">お客様名</th>
                                    <th className="py-3 px-2 font-semibold text-right">総売上</th>
                                    <th className="py-3 px-2 font-semibold text-right text-[#007AFF]">あなたの報酬額</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {reports.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-gray-400">履歴がありません</td>
                                    </tr>
                                ) : (
                                    reports.map((r, i) => (
                                        <tr key={i} className="text-gray-700 print:text-black">
                                            <td className="py-4 px-2">{new Date(r.date).toLocaleDateString('ja-JP')}</td>
                                            <td className="py-4 px-2">{r.customerName}</td>
                                            <td className="py-4 px-2 text-right">¥{r.totalSales.toLocaleString()}</td>
                                            <td className="py-4 px-2 text-right font-bold text-gray-900">¥{r.staffShare.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-16 pt-8 border-t border-gray-100 text-center text-xs text-gray-400">
                        <p>※本明細書はシステムによって自動生成されています。</p>
                        <p className="mt-1">ハナシタラ.com サポートセンター</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';

// ①取得データの型定義
interface ReportData {
    id: string; // GASで生成したUUID
    date: string;
    staff: string;
    customerName: string;
    customerPhone: string;
    services: string;
    totalSales: number;
    staffShare: number;
    isPaid: boolean;
    daysPending: number; // 未入金日数（フロントエンドで計算）
}

export default function AdminDashboard() {
    const [reports, setReports] = useState<ReportData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorText, setErrorText] = useState('');

    // コピー完了アニメーション表示用
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // ブラックリスト保持用
    const [blacklistedPhones, setBlacklistedPhones] = useState<string[]>([]);

    const GAS_URL = 'https://script.google.com/macros/s/AKfycbzopMne7Ga8ZruWAf3xvAP7WQFvQ-Uau09qsmG2K6-Mcs7xfrXXl1Ev4GmLHpOcgTwj/exec';

    // ②初回読み込み時に全データを取得する
    useEffect(() => {
        fetchReports();
        fetchBlacklist();
    }, []);

    const fetchBlacklist = async () => {
        try {
            const res = await fetch(`${GAS_URL}?action=getBlacklistPhones`);
            const json = await res.json();
            if (json.success) {
                setBlacklistedPhones(json.phones || []);
            }
        } catch (err) {
            console.error('ブラックリスト取得エラー:', err);
        }
    };

    const fetchReports = async () => {
        setIsLoading(true);
        try {
            // GASの doGet 側を叩く (action=getReports)
            const res = await fetch(`${GAS_URL}?action=getReports`);
            const json = await res.json();

            if (json.success) {
                // 取得した二次元配列をオブジェクト形式に整形＋日数の計算
                const today = new Date();
                const formattedData: ReportData[] = json.data.map((row: any[]) => {
                    // A:ID(0), B:日付(1), C:スタッフ(2), D:顧客電話(3), E:顧客名(4), 
                    // F:提供サービス(5), G:総売上(6), H:スタッフ報酬(7), I:入金済(8)

                    // 未入金日数の計算
                    let days = 0;
                    const isPaidStatus = row[8] === '入金済' || row[8] === true || row[8] === 'TRUE';
                    if (!isPaidStatus && row[1]) {
                        const reportDate = new Date(row[1]);
                        const diffTime = Math.abs(today.getTime() - reportDate.getTime());
                        days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    }

                    return {
                        id: row[0],
                        date: row[1],
                        staff: row[2],
                        customerPhone: row[3],
                        customerName: row[4],
                        services: row[5],
                        totalSales: Number(row[6]) || 0,
                        staffShare: Number(row[7]) || 0,
                        isPaid: isPaidStatus,
                        daysPending: days
                    };
                });

                // 日付の新しい順に並び替え（降順）
                formattedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setReports(formattedData);
            } else {
                setErrorText('データの取得に失敗しました: ' + json.message);
            }
        } catch (err) {
            console.error(err);
            setErrorText('通信エラーが発生しました。');
        } finally {
            setIsLoading(false);
        }
    };

    const togglePaidStatus = async (id: string, currentPaid: boolean) => {
        const newPaidStatus = !currentPaid;
        // 画面上の見た目を即座に切り替える
        setReports(reports.map(r => r.id === id ? { ...r, isPaid: newPaidStatus } : r));

        try {
            // GASへ通信してスプレッドシートを更新
            await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'updatePaidStatus',
                    id: id,
                    isPaid: newPaidStatus
                }),
            });
        } catch (error) {
            console.error('更新エラー:', error);
            alert('通信エラーが発生しました。元の状態に戻ります。');
            // エラー時は画面を元に戻す
            setReports(reports.map(r => r.id === id ? { ...r, isPaid: currentPaid } : r));
        }
    };

    const handleAddBlacklist = async (phone: string, name: string) => {
        const reason = window.prompt(`${name}さん (${phone}) をブラックリストに登録する理由を入力してください（イタズラ、未払い等）`);
        if (!reason) return; // キャンセル

        // 即座にUIへ反映
        setBlacklistedPhones(prev => [...prev, phone]);

        try {
            await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'addBlacklist', phone, name, reason }),
            });
            alert('ブラックリストに登録しました。');
        } catch (err) {
            console.error('ブラックリスト登録エラー:', err);
            alert('通信エラーが発生しました。時間を置いて再度お試しください。');
            // エラー時は元に戻す
            setBlacklistedPhones(prev => prev.filter(p => p !== phone));
        }
    };

    // 督促文をクリップボードにコピーする関数
    const handleCopyRemind = (report: ReportData) => {
        const text = `${report.customerName} 様
        
いつもハナシタラ.comをご利用いただき、誠にありがとうございます。
${new Date(report.date).toLocaleDateString('ja-JP')} にご利用いただきました下記サービスにつきまして、現在ご入金の確認がとれておりません。

【ご利用内容】: ${report.services}
【ご請求金額】: ¥${report.totalSales.toLocaleString()}-

お手数をおかけいたしますが、指定の口座までご入金をお願い申し上げます。
行き違いで既にお振込済みの場合は、何卒ご容赦くださいませ。

引き続き、ハナシタラ.comをよろしくお願いいたします。`;

        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(report.id);
            setTimeout(() => setCopiedId(null), 2000); // 2秒後に「コピーしました」の表示を消す
        }).catch(err => {
            console.error('コピー失敗:', err);
            alert('クリップボードへのコピーに失敗しました。');
        });
    };

    // ---- フェーズ4: 集計ロジック ----
    const currentYear = new Date().getFullYear();
    const currentMonthStr = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // 1. 年間合計（当年）
    const yearReports = reports.filter(r => new Date(r.date).getFullYear() === currentYear);
    const totalYearSales = yearReports.reduce((sum, r) => sum + r.totalSales, 0);
    const totalYearProfit = yearReports.reduce((sum, r) => sum + (r.totalSales - r.staffShare), 0);

    // 2. 今月分合計
    const monthReports = reports.filter(r => {
        const d = new Date(r.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === currentMonthStr;
    });
    const totalMonthSales = monthReports.reduce((sum, r) => sum + r.totalSales, 0);
    const totalMonthProfit = monthReports.reduce((sum, r) => sum + (r.totalSales - r.staffShare), 0);

    // 3. 全ての未入金額
    const totalUnpaid = reports.filter(r => !r.isPaid).reduce((sum, r) => sum + r.totalSales, 0);

    // 4. スタッフ別集計（今月）
    const staffStatsMap = new Map<string, { sales: number, share: number }>();
    monthReports.forEach(r => {
        const current = staffStatsMap.get(r.staff) || { sales: 0, share: 0 };
        staffStatsMap.set(r.staff, {
            sales: current.sales + r.totalSales,
            share: current.share + r.staffShare
        });
    });
    const staffStats = Array.from(staffStatsMap.entries())
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.sales - a.sales);

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8 pb-32">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-4 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">オーナーダッシュボード</h1>
                    <p className="text-sm text-gray-500 mt-1">売上管理・入金確認</p>
                </div>
            </header>

            {/* 集計サマリー表示 (フェーズ4) */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 総合サマリー */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
                    <h2 className="font-bold text-gray-800 border-b border-gray-100 pb-2">サマリー ({currentMonthStr.replace('-', '年')}月)</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-500 mb-1 font-medium">今月の総売上</p>
                            <p className="text-xl font-bold text-gray-900">¥{totalMonthSales.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-blue-600 mb-1 font-bold">✨ オーナー利益</p>
                            <p className="text-xl font-bold text-blue-600">¥{totalMonthProfit.toLocaleString()}</p>
                        </div>
                        <div className="pt-2 border-t border-gray-100 col-span-2">
                            <p className="text-xs text-gray-500 mb-1 font-medium">現在の未入金総額</p>
                            <p className="text-lg font-bold text-red-500">¥{totalUnpaid.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* 年間サマリー */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 text-6xl">📈</div>
                    <h2 className="font-bold border-b border-gray-100 pb-2 text-gray-800">確定申告用 ({currentYear}年 累計)</h2>
                    <div className="flex-1 flex flex-col justify-center gap-4 relative z-10">
                        <div>
                            <p className="text-xs text-gray-500 mb-1 font-medium">年間 総売上</p>
                            <p className="text-2xl font-bold text-gray-900">¥{totalYearSales.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-blue-600 mb-1 font-bold">年間 オーナー純利益</p>
                            <p className="text-xl font-bold text-blue-600">¥{totalYearProfit.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* スタッフ別実績（今月） */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full max-h-[250px] overflow-hidden">
                    <h2 className="font-bold text-gray-800 border-b border-gray-100 pb-2 mb-3">スタッフ別実績 ({currentMonthStr.replace('-', '年')}月)</h2>
                    <div className="overflow-y-auto pr-2 space-y-3">
                        {staffStats.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">データがありません</p>
                        ) : (
                            <ul className="space-y-3">
                                {staffStats.map(s => (
                                    <li key={s.name} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0">
                                        <span className="font-semibold text-gray-700">{s.name}</span>
                                        <div className="text-right">
                                            <p className="text-gray-900 font-medium">売上: ¥{s.sales.toLocaleString()}</p>
                                            <p className="text-[11px] text-gray-400 mt-0.5">報酬: ¥{s.share.toLocaleString()}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </section>

            {/* 報告データ一覧・入金チェック */}
            <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
                    <h2 className="font-semibold text-gray-800">最新の業務報告 / 入金確認</h2>
                </div>
                <div className="overflow-x-auto relative">

                    {/* ローディング表示とエラー表示 */}
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/70 flex justify-center items-center z-10 backdrop-blur-sm">
                            <span className="text-gray-500 font-medium animate-pulse">データを取得中...</span>
                        </div>
                    )}
                    {errorText && (
                        <div className="p-4 bg-red-50 text-red-600 text-sm border-b font-medium">
                            {errorText}
                        </div>
                    )}

                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 border-b">
                            <tr>
                                <th className="px-6 py-3 font-medium">日付</th>
                                <th className="px-6 py-3 font-medium">スタッフ</th>
                                <th className="px-6 py-3 font-medium">お客様名 (電話) / サービス</th>
                                <th className="px-6 py-3 font-medium text-right">売上額</th>
                                <th className="px-6 py-3 font-medium text-right">スタッフ報酬</th>
                                <th className="px-6 py-3 font-medium text-center">入金状況</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {reports.length === 0 && !isLoading && !errorText && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                                        報告データがまだありません
                                    </td>
                                </tr>
                            )}
                            {reports.map((report) => (
                                <tr key={report.id} className={`hover:bg-gray-50/50 transition-colors ${!report.isPaid && report.daysPending >= 3 ? 'bg-red-50/30' : ''}`}>
                                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{new Date(report.date).toLocaleDateString('ja-JP')}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900">{report.staff}</td>
                                    <td className="px-6 py-4 text-gray-600">
                                        <div className="font-medium text-gray-800 flex items-center gap-2">
                                            {report.customerName}
                                            {blacklistedPhones.includes(report.customerPhone) && (
                                                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold border border-red-200">ブラックリスト受診拒否</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                                            {report.customerPhone}
                                            {!blacklistedPhones.includes(report.customerPhone) && (
                                                <button
                                                    onClick={() => handleAddBlacklist(report.customerPhone, report.customerName)}
                                                    className="text-[10px] text-gray-400 hover:text-red-500 underline transition-colors"
                                                >
                                                    ブラックリストに登録
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded inline-block mt-1">{report.services}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-gray-900">¥{report.totalSales.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right text-gray-600">¥{report.staffShare.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-center gap-2">
                                            <button
                                                onClick={() => togglePaidStatus(report.id, report.isPaid)}
                                                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors border shadow-sm w-full max-w-[100px] ${report.isPaid
                                                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {report.isPaid ? '✓ 入金済' : '未入金'}
                                            </button>
                                            {!report.isPaid && (
                                                <div className="flex flex-col items-center gap-1.5 w-full">
                                                    {report.daysPending >= 3 && (
                                                        <span className="text-[10px] text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded w-full text-center">3日経過!</span>
                                                    )}
                                                    <button
                                                        onClick={() => handleCopyRemind(report)}
                                                        className={`text-[10px] w-full max-w-[100px] py-1 border rounded transition-colors flex justify-center items-center ${copiedId === report.id ? 'bg-green-50 text-green-600 border-green-200' : 'border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100'}`}
                                                    >
                                                        {copiedId === report.id ? '✓ コピー完了' : '📝督促をコピー'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

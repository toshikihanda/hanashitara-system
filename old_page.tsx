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

    const GAS_URL = 'https://script.google.com/macros/s/AKfycbzopMne7Ga8ZruWAf3xvAP7WQFvQ-Uau09qsmG2K6-Mcs7xfrXXl1Ev4GmLHpOcgTwj/exec';

    // ②初回読み込み時に全データを取得する
    useEffect(() => {
        fetchReports();
    }, []);

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
        // 画面上の見た目を即座に切り替える（UX用）
        setReports(reports.map(r => r.id === id ? { ...r, isPaid: !r.isPaid } : r));

        // 【TODO】次のフェーズで、ここへ「GASの特定の行のI列（入金済）を更新する」処理を入れる予定です。
        // 今回は画面の一時切り替えのみ
    };

    // 全体の総売上と未入金額の計算
    const totalMonthSales = reports.reduce((sum, r) => sum + r.totalSales, 0);
    const totalUnpaid = reports.reduce((sum, r) => !r.isPaid ? sum + r.totalSales : sum, 0);

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            <header className="flex justify-between items-end border-b pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">オーナー管理画面</h1>
                    <p className="text-sm text-gray-500 mt-1">入金確認・売上管理ダッシュボード</p>
                </div>
                <div className="flex gap-4 text-sm">
                    <div className="bg-white px-4 py-2 rounded-lg shadow-sm border">
                        <span className="text-gray-500">今月の総売上: </span>
                        <span className="font-bold text-gray-900">¥{totalMonthSales.toLocaleString()}</span>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-lg shadow-sm border">
                        <span className="text-gray-500">未入金総額: </span>
                        <span className="font-bold text-red-600">¥{totalUnpaid.toLocaleString()}</span>
                    </div>
                </div>
            </header>

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
                                        <div className="font-medium text-gray-800">{report.customerName}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">{report.customerPhone}</div>
                                        <div className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded inline-block mt-1">{report.services}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-gray-900">¥{report.totalSales.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right text-gray-600">¥{report.staffShare.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-center gap-2">
                                            <button
                                                onClick={() => togglePaidStatus(report.id, report.isPaid)}
                                                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors border shadow-sm ${report.isPaid
                                                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {report.isPaid ? '✓ 入金済' : '未入金'}
                                            </button>
                                            {!report.isPaid && report.daysPending >= 3 && (
                                                <span className="text-[10px] text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded">3日経過!</span>
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

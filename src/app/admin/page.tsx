'use client';

import { useState } from 'react';

// ダミーデータ（本来はDBから取得）
const mockReports = [
    { id: 1, staff: 'スタッフA', customer: '鈴木サトシ', phone: '090-1111-2222', date: '2026-02-21', totalSales: 3000, staffShare: 1800, isPaid: false, daysPending: 1 },
    { id: 2, staff: 'スタッフB', customer: '匿名', phone: '080-3333-4444', date: '2026-02-18', totalSales: 5000, staffShare: 3500, isPaid: false, daysPending: 4 }, // 3日以上未入金
    { id: 3, staff: 'スタッフA', customer: '田中さん', phone: '070-5555-6666', date: '2026-02-15', totalSales: 1000, staffShare: 700, isPaid: true, daysPending: 0 },
];

export default function AdminDashboard() {
    const [reports, setReports] = useState(mockReports);

    const togglePaidStatus = (id: number) => {
        setReports(reports.map(r => r.id === id ? { ...r, isPaid: !r.isPaid } : r));
    };

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
                        <span className="font-bold text-gray-900">¥125,000</span>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-lg shadow-sm border">
                        <span className="text-gray-500">未入金総額: </span>
                        <span className="font-bold text-red-600">¥8,000</span>
                    </div>
                </div>
            </header>

            {/* 報告データ一覧・入金チェック */}
            <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
                    <h2 className="font-semibold text-gray-800">最新の業務報告 / 入金確認</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 border-b">
                            <tr>
                                <th className="px-6 py-3 font-medium">日付</th>
                                <th className="px-6 py-3 font-medium">スタッフ</th>
                                <th className="px-6 py-3 font-medium">お客様名 (電話)</th>
                                <th className="px-6 py-3 font-medium text-right">売上額</th>
                                <th className="px-6 py-3 font-medium text-right">スタッフ報酬</th>
                                <th className="px-6 py-3 font-medium text-center">入金状況</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {reports.map((report) => (
                                <tr key={report.id} className={`hover:bg-gray-50/50 transition-colors ${!report.isPaid && report.daysPending >= 3 ? 'bg-red-50/30' : ''}`}>
                                    <td className="px-6 py-4 text-gray-600">{report.date}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900">{report.staff}</td>
                                    <td className="px-6 py-4 text-gray-600">
                                        <div>{report.customer}</div>
                                        <div className="text-xs text-gray-400">{report.phone}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-gray-900">¥{report.totalSales.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right text-gray-600">¥{report.staffShare.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-center gap-2">
                                            <button
                                                onClick={() => togglePaidStatus(report.id)}
                                                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors border ${report.isPaid
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

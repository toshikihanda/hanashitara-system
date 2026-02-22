'use client';

import { useState } from 'react';

type ServiceType = 'listen' | 'fortune' | 'sexual';

interface ServiceDetail {
    type: ServiceType;
    minutes: number;
}

export default function ReportForm() {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [services, setServices] = useState<ServiceDetail[]>([{ type: 'listen', minutes: 0 }]);

    // サービス追加用のハンドラ
    const handleAddService = () => {
        setServices([...services, { type: 'listen', minutes: 0 }]);
    };

    // サービスごとの更新ハンドラ
    const handleServiceChange = (index: number, field: keyof ServiceDetail, value: any) => {
        const newServices = [...services];
        newServices[index] = { ...newServices[index], [field]: value };
        setServices(newServices);
    };

    // サービス削除ハンドラ
    const handleRemoveService = (index: number) => {
        if (services.length === 1) return;
        const newServices = services.filter((_, i) => i !== index);
        setServices(newServices);
    };

    // 料金と取り分の計算ロジック
    const calculateTotals = () => {
        let totalSales = 0;
        let staffShare = 0;

        services.forEach(service => {
            const units = service.minutes / 10;
            if (service.type === 'listen') { // 傾聴: 10分300円、スタッフ6割
                const price = units * 300;
                totalSales += price;
                staffShare += price * 0.6;
            } else if (service.type === 'fortune') { // 占い: 10分1000円、スタッフ7割
                const price = units * 1000;
                totalSales += price;
                staffShare += price * 0.7;
            } else if (service.type === 'sexual') { // 性的相談: 10分500円、スタッフ7割
                const price = units * 500;
                totalSales += price;
                staffShare += price * 0.7;
            }
        });

        return { totalSales, staffShare };
    };

    const totals = calculateTotals();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: ここでSupabase等へデータを送信する
        alert('業務報告を送信しました！（テスト完了）\n売上: ' + totals.totalSales + '円');
    };

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-800 tracking-tight">日々の業務報告</h2>
                <p className="text-sm text-gray-500 mt-1">通話内容と金額を入力してください</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* お客様情報 */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            お客様の電話番号 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            required
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                            placeholder="090-1234-5678"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            お客様名（ニックネーム可）
                        </label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                            placeholder="鈴木 サトシ"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                        />
                    </div>
                </div>

                {/* サービス内容（複数混在対応） */}
                <div className="bg-gray-50 -mx-4 sm:-mx-6 px-4 sm:px-6 py-5 rounded-lg border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-3">提供サービスと通話時間（10分単位で合算されます）</label>

                    <div className="space-y-3">
                        {services.map((service, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <select
                                    className="flex-1 min-w-[120px] px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    value={service.type}
                                    onChange={(e) => handleServiceChange(index, 'type', e.target.value)}
                                >
                                    <option value="listen">傾聴（10分/300円）</option>
                                    <option value="fortune">占い（10分/1,000円）</option>
                                    <option value="sexual">性的な相談（10分/500円）</option>
                                </select>

                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="0"
                                        step="10"
                                        className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                                        placeholder="0"
                                        value={service.minutes || ''}
                                        onChange={(e) => handleServiceChange(index, 'minutes', parseInt(e.target.value) || 0)}
                                    />
                                    <span className="text-sm text-gray-500 whitespace-nowrap">分</span>
                                </div>

                                {services.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveService(index)}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={handleAddService}
                        className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                        <span>＋</span> 別のサービスを追加する（合算用）
                    </button>
                </div>

                {/* 自動計算結果 */}
                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                    <h3 className="text-sm font-medium text-blue-900 mb-3">今回のお給料計算（自動）</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center text-gray-600">
                            <span>お客様への総請求予定額（売上）</span>
                            <span className="font-semibold">{Math.floor(totals.totalSales).toLocaleString()} 円</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-blue-100/50 pt-2">
                            <span className="text-blue-800 font-medium">スタッフ様 取り分</span>
                            <span className="text-lg font-bold text-blue-600">{Math.floor(totals.staffShare).toLocaleString()} 円</span>
                        </div>
                    </div>
                </div>

                {/* 送信ボタン */}
                <button
                    type="submit"
                    className="w-full bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-sm active:scale-[0.98]"
                >
                    この内容で報告を送信する
                </button>
            </form>
        </div>
    );
}

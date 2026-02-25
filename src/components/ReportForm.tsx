'use client';

import { useState, useEffect } from 'react';

type ServiceType = 'listen' | 'fortune' | 'sexual';

interface ServiceDetail {
    type: ServiceType;
    minutes: number;
}

export default function ReportForm() {
    const [staffName, setStaffName] = useState('');
    const [reportDate, setReportDate] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    });
    const [phoneNumber, setPhoneNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [services, setServices] = useState<ServiceDetail[]>([{ type: 'listen', minutes: 0 }]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // スタッフリストをGASから取得する
    const [staffList, setStaffList] = useState<string[]>(['吉川', 'スタッフA', 'スタッフB', 'スタッフC']);

    // お客様データ保持用（名前自動補完）とブラックリスト
    const [customersMap, setCustomersMap] = useState<Record<string, string>>({});
    const [blacklistedPhones, setBlacklistedPhones] = useState<string[]>([]);

    const GAS_URL = 'https://script.google.com/macros/s/AKfycbzopMne7Ga8ZruWAf3xvAP7WQFvQ-Uau09qsmG2K6-Mcs7xfrXXl1Ev4GmLHpOcgTwj/exec';

    useEffect(() => {
        // 初回のみ顧客情報とブラックリスト、スタッフリストを取得
        fetch(`${GAS_URL}?action=getCustomerInfo`)
            .then(res => res.json())
            .then(json => {
                if (json.success) {
                    setCustomersMap(json.customers || {});
                    setBlacklistedPhones(json.blacklistedPhones || []);
                }
            }).catch(err => console.error('顧客情報取得エラー:', err));

        fetch(`${GAS_URL}?action=getStaffList`)
            .then(res => res.json())
            .then(json => {
                if (json.success && json.staff && json.staff.length > 0) {
                    setStaffList(json.staff.map((s: any) => s.name));
                }
            }).catch(err => console.error('スタッフ取得エラー:', err));
    }, []);

    const isBlacklisted = phoneNumber && blacklistedPhones.includes(phoneNumber);

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
            // 5分単位で四捨五入する
            const roundedMinutes = Math.round(service.minutes / 5) * 5;
            const units = roundedMinutes / 10;
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

    const handleSubmit = async (e: React.FormEvent, forceSubmit = false) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            // 送信データの整形（GASへ送る形式） - 日付は選択された値を使用
            const formattedDate = new Date(reportDate).toLocaleDateString('ja-JP');
            const reportData = {
                action: 'addReport',
                checkDuplicate: !forceSubmit, // 初回送信時は重複チェックをお願いする
                date: formattedDate,
                staff: staffName,
                customerPhone: phoneNumber,
                customerName: customerName || '名無し',
                services: services.map(s => {
                    const typeName = s.type === 'listen' ? '傾聴' : s.type === 'fortune' ? '占い' : '性的な相談';
                    const rounded = Math.round(s.minutes / 5) * 5;
                    return `${typeName}(${s.minutes}分 -> 計算${rounded}分)`;
                }).join(', '),
                totalSales: totals.totalSales,
                staffShare: totals.staffShare
            };

            // スプレッドシート（GAS）へ通信
            const res = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(reportData),
            });

            // GASからのJSONレスポンスをパース
            let data = null;
            try {
                data = await res.json();
            } catch (e) {
                console.error("JSON parse error:", e);
            }

            // 重複チェックによる警告ダイアログ
            if (data && data.duplicate && !forceSubmit) {
                setIsSubmitting(false); // 一旦ローディング解除
                const confirmMsg = `⚠️【重複警告】\n「${formattedDate}」の「${customerName || phoneNumber}」様に対する「${staffName}」さんの報告は既に存在します。\n\n追加で登録してもよろしいですか？`;
                if (window.confirm(confirmMsg)) {
                    // OKなら強制送信フラグを立てて再実行
                    return handleSubmit(e, true);
                } else {
                    return; // キャンセルした場合はここで処理終了
                }
            }

            // メッセージの組み立て
            if (data && data.autoDeducted) {
                alert(`業務報告を送信しました！\n売上: ${totals.totalSales}円\n\n✅ お客様の前払い残高から自動で引き落とされ、「入金済」として処理されました。`);
            } else if (data && data.insufficientBalance) {
                alert(`業務報告を送信しました！\n売上: ${totals.totalSales}円\n\n⚠️ お客様は前払い顧客ですが、残高（¥${data.currentDeposit}）が不足しているため自動引き落としできませんでした。「未入金」となっていますのでご請求をお願いします。`);
            } else {
                alert(`業務報告を送信しました！\n明細がスプレッドシートに追記されます。\n売上: ${totals.totalSales}円`);
            }

            // 送信成功後、次の入力用にフォームをリセットする
            setPhoneNumber('');
            setCustomerName('');
            setServices([{ type: 'listen', minutes: 0 }]);
        } catch (error) {
            console.error('送信エラー:', error);
            alert('エラーが発生しました。ネットワーク環境を確認してください。');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-800 tracking-tight">日々の業務報告</h2>
                <p className="text-sm text-gray-500 mt-1">通話内容と金額を入力してください</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* スタッフ情報と日付 */}
                <div className="space-y-4 border-b border-gray-100 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4 mt-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            スタッフ名 <span className="text-red-500">*</span>
                        </label>
                        <select
                            required
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            value={staffName}
                            onChange={(e) => setStaffName(e.target.value)}
                        >
                            <option value="">（お名前を選択してください）</option>
                            {staffList.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            対応日 (報告を忘れた場合は過去を選択)
                        </label>
                        <input
                            type="date"
                            required
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            value={reportDate}
                            onChange={(e) => setReportDate(e.target.value)}
                        />
                    </div>
                </div>

                {/* お客様情報 */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            お客様の電話番号 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            required
                            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${isBlacklisted ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                            placeholder="090-1234-5678"
                            value={phoneNumber}
                            onChange={(e) => {
                                const val = e.target.value;
                                setPhoneNumber(val);
                                // 電話番号に変更があった時、過去の履歴からお客様名を自動補完する
                                if (customersMap[val]) {
                                    setCustomerName(customersMap[val]);
                                }
                            }}
                        />
                        {isBlacklisted && (
                            <p className="mt-2 text-sm font-semibold text-red-600 bg-red-100/50 p-2 rounded border border-red-200">
                                ⚠️ この電話番号のお客様はブラックリストに登録されています！<br />通話をお断りするなどの対応をご検討ください。
                            </p>
                        )}
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
                    <label className="block text-sm font-medium text-gray-700 mb-3">提供サービスと通話時間（実際の通話分数を入力）</label>
                    <p className="text-xs text-gray-500 mb-3">※システム側で自動的に5分単位の四捨五入が行われます。</p>

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
                                        step="1"
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
                    disabled={isSubmitting || totals.totalSales === 0 || !staffName}
                    className={`w-full font-medium py-3 px-4 rounded-xl transition-all shadow-sm active:scale-[0.98] text-white flex justify-center items-center gap-2 ${isSubmitting || totals.totalSales === 0 || !staffName
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-[#007AFF] hover:bg-[#007AFF]/90'
                        }`}
                >
                    {isSubmitting ? '送信中（少々お待ちください）...' : 'この内容で報告を送信する'}
                </button>
            </form>
        </div>
    );
}

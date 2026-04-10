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
    const [reportTime, setReportTime] = useState(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });
    const [phoneNumber, setPhoneNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [services, setServices] = useState<ServiceDetail[]>([{ type: 'listen', minutes: 0 }]);
    const [memo, setMemo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // スタッフリストをGASから取得する（デフォルトは空、ローディング中は「読み込み中...」を表示）
    const [staffList, setStaffList] = useState<string[]>([]);
    const [isLoadingStaffList, setIsLoadingStaffList] = useState(true);

    // お客様データ保持用（名前自動補完）とブラックリスト
    const [customersMap, setCustomersMap] = useState<Record<string, string>>({});
    const [blacklistedPhones, setBlacklistedPhones] = useState<string[]>([]);

    const GAS_URL = 'https://script.google.com/macros/s/AKfycbzhzZLoVQRSYYykqnu88ebBtx79htz-3A7YDa3RgBKbjYJ-ie308nsQXhJflpEnNfuz0g/exec';

    // 電話番号を正規化（ハイフンを削除）
    const normalizePhone = (phone: string) => {
        return phone.replace(/-/g, '');
    };

    // 電話番号を表示用にフォーマット（XXX-XXXX-XXXX形式に変換）
    const formatPhone = (phone: string) => {
        const normalized = normalizePhone(phone);
        if (normalized.length === 11) {
            return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
        } else if (normalized.length === 10) {
            return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
        }
        return phone; // そのまま返す
    };

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
            })
            .catch(err => console.error('スタッフ取得エラー:', err))
            .finally(() => setIsLoadingStaffList(false));
    }, []);

    // ブラックリストチェック（ハイフンを削除して比較）
    const isBlacklisted = phoneNumber && blacklistedPhones.some(bl => normalizePhone(bl) === normalizePhone(phoneNumber));

    // 新規顧客判定（十分な桁数があり、かつ既存顧客に一致しない場合）
    const normalizedPhone = normalizePhone(phoneNumber);
    const isNewCustomer = normalizedPhone.length >= 10 && !Object.keys(customersMap).some(
        phone => normalizePhone(phone) === normalizedPhone
    );

    // 「もしかして」候補（1文字違いの既存顧客）
    const [similarCustomer, setSimilarCustomer] = useState<{ phone: string, name: string } | null>(null);

    // 1文字違い判定（11桁中10桁一致 = 1文字だけ異なる）
    const findSimilarPhone = (inputPhone: string): { phone: string, name: string } | null => {
        const normalized = normalizePhone(inputPhone);
        if (normalized.length < 10) return null;
        for (const [phone, name] of Object.entries(customersMap)) {
            const existing = normalizePhone(phone);
            if (existing === normalized) continue; // 完全一致はスキップ
            if (existing.length !== normalized.length) continue;
            let diffCount = 0;
            for (let i = 0; i < existing.length; i++) {
                if (existing[i] !== normalized[i]) diffCount++;
                if (diffCount > 1) break;
            }
            if (diffCount === 1) return { phone: formatPhone(existing), name };
        }
        return null;
    };

    // 電話番号変更時のハンドラ（顧客名自動補完 + もしかして判定）
    const handlePhoneNumberChange = (value: string) => {
        setPhoneNumber(value);

        const normalizedInput = normalizePhone(value);
        let foundName = '';

        for (const [phone, name] of Object.entries(customersMap)) {
            if (normalizePhone(phone) === normalizedInput) {
                foundName = name;
                break;
            }
        }

        if (foundName) {
            setCustomerName(foundName);
            setSimilarCustomer(null);
        } else if (normalizedInput.length >= 10) {
            setCustomerName('');
            setSimilarCustomer(findSimilarPhone(value));
        } else {
            setSimilarCustomer(null);
        }
    };

    // 「もしかして」の候補を採用する
    const applySuggestion = (suggestedPhone: string) => {
        const normalized = normalizePhone(suggestedPhone);
        setPhoneNumber(formatPhone(normalized));
        setSimilarCustomer(null);
        // 顧客名を自動設定
        for (const [phone, name] of Object.entries(customersMap)) {
            if (normalizePhone(phone) === normalized) {
                setCustomerName(name);
                break;
            }
        }
    };

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

    // オーナー判定（手数料なしで100%がオーナー売上になる）
    const isOwner = staffName === '吉川（オーナー）';

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
                staffShare += isOwner ? price : price * 0.6;
            } else if (service.type === 'fortune') { // 占い: 10分1000円、スタッフ7割
                const price = units * 1000;
                totalSales += price;
                staffShare += isOwner ? price : price * 0.7;
            } else if (service.type === 'sexual') { // 性的相談: 10分500円、スタッフ7割
                const price = units * 500;
                totalSales += price;
                staffShare += isOwner ? price : price * 0.7;
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
            // 新規顧客の場合、名前が未入力なら警告
            if (isNewCustomer && !customerName.trim()) {
                alert('新規のお客様を登録するには、お客様名の入力が必要です。');
                setIsSubmitting(false);
                return;
            }

            // 送信データの整形（GASへ送る形式） - 日付+時刻をJST形式で送信
            const [year, month, day] = reportDate.split('-');
            const formattedDate = `${year}/${month}/${day} ${reportTime}:00`;
            const reportData = {
                action: 'addReport',
                checkDuplicate: !forceSubmit, // 初回送信時は重複チェックをお願いする
                isNewCustomer: isNewCustomer, // 新規顧客フラグ
                date: formattedDate,
                staff: staffName,
                customerPhone: normalizePhone(phoneNumber), // ハイフンを削除して保存
                customerName: customerName || '名無し',
                services: services.map(s => {
                    const typeName = s.type === 'listen' ? '傾聴' : s.type === 'fortune' ? '占い' : '性的な相談';
                    const rounded = Math.round(s.minutes / 5) * 5;
                    return `${typeName}(${s.minutes}分 -> 計算${rounded}分)`;
                }).join(', '),
                totalSales: totals.totalSales,
                staffShare: totals.staffShare,
                memo: memo.trim()
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

            // サーバー混雑エラー（排他制御によるロック失敗）
            if (data && !data.success && data.message && data.message.includes('混み合って')) {
                alert(`⚠️ ${data.message}\n\n数秒後にもう一度お試しください。`);
                setIsSubmitting(false);
                return;
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
                alert(`業務報告を送信しました！\n明細がスプレッドシートに追記されます。\n売上: ${totals.totalSales}円${data && data.emailSent ? '\n\n📧 確認メールをお送りしました。' : ''}`);
            }

            // 送信成功後、次の入力用にフォームをリセットする
            setPhoneNumber('');
            setCustomerName('');
            setMemo('');
            setServices([{ type: 'listen', minutes: 0 }]);
        } catch (error) {
            console.error('送信エラー:', error);
            alert('エラーが発生しました。ネットワーク環境を確認してください。');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="mb-6 pb-4 border-b dark:border-gray-700 border-gray-100 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 tracking-tight">日々の業務報告</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">通話内容と金額を入力してください</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* スタッフ情報と日付 */}
                <div className="border-b dark:border-gray-700 border-gray-100 pb-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            スタッフ名 <span className="text-red-500">*</span>
                        </label>
                        <select
                            required
                            disabled={isLoadingStaffList}
                            className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            value={staffName}
                            onChange={(e) => setStaffName(e.target.value)}
                        >
                            <option value="">
                                {isLoadingStaffList ? '読み込み中...' : '（お名前を選択してください）'}
                            </option>
                            {staffList.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                対応日 <span className="text-xs text-gray-400 font-normal">※過去日も選択可</span>
                            </label>
                            <input
                                type="date"
                                required
                                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
                                value={reportDate}
                                onChange={(e) => setReportDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                対応時刻
                            </label>
                            <input
                                type="time"
                                required
                                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
                                value={reportTime}
                                onChange={(e) => setReportTime(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* お客様情報 */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            お客様の電話番号 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            required
                            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${isBlacklisted ? 'border-red-400 bg-red-50' : isNewCustomer && !similarCustomer ? 'border-amber-400 bg-amber-50/50' : 'border-gray-200 dark:border-gray-700'}`}
                            placeholder="090-1234-5678"
                            value={phoneNumber}
                            onChange={(e) => handlePhoneNumberChange(e.target.value)}
                        />
                        {isBlacklisted && (
                            <p className="mt-2 text-sm font-semibold text-red-600 bg-red-100/50 p-2 rounded border border-red-200">
                                ⚠️ この電話番号のお客様はブラックリストに登録されています！<br />通話をお断りするなどの対応をご検討ください。
                            </p>
                        )}
                        {similarCustomer && !isBlacklisted && (
                            <div className="mt-2 text-sm bg-blue-50 p-3 rounded-lg border border-blue-200">
                                <p className="font-medium text-blue-800 mb-1.5">もしかして：{similarCustomer.phone}（{similarCustomer.name} 様）の間違いですか？</p>
                                <button
                                    type="button"
                                    onClick={() => applySuggestion(similarCustomer.phone)}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    この番号に修正する
                                </button>
                            </div>
                        )}
                        {isNewCustomer && !isBlacklisted && !similarCustomer && (
                            <p className="mt-2 text-sm font-medium text-amber-700 bg-amber-50 p-2 rounded border border-amber-300">
                                ⚠️ 新規のお客様として登録されます。番号に間違いがないか確認してください。
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            お客様名（ニックネーム可）
                        </label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                            placeholder="鈴木 サトシ"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                        />
                    </div>
                </div>

                {/* サービス内容（複数混在対応） */}
                <div className="bg-gray-50 dark:bg-gray-900 -mx-4 sm:-mx-6 px-4 sm:px-6 py-5 rounded-lg border border-gray-100 dark:border-gray-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">提供サービスと通話時間（実際の通話分数を入力）</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">※システム側で自動的に5分単位の四捨五入が行われます。</p>

                    <div className="space-y-3">
                        {services.map((service, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <select
                                    className="flex-1 min-w-[120px] px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
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
                                        className="w-20 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                                        placeholder="0"
                                        value={service.minutes || ''}
                                        onChange={(e) => handleServiceChange(index, 'minutes', parseInt(e.target.value) || 0)}
                                    />
                                    <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">分</span>
                                </div>

                                {services.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveService(index)}
                                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"
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

                {/* メモ・備考欄 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        メモ・備考（任意）
                    </label>
                    <textarea
                        className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow bg-white dark:bg-gray-800 resize-none"
                        rows={3}
                        maxLength={500}
                        placeholder="お客様の様子、NGトピック、次回への申し送りなど"
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                    />
                    {memo.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1 text-right">{memo.length}/500</p>
                    )}
                </div>

                {/* 自動計算結果 */}
                <div className="bg-blue-50/50 rounded-xl p-4 border border-b dark:border-gray-700lue-100">
                    <h3 className="text-sm font-medium text-blue-900 mb-3">{isOwner ? '今回の売上計算（自動）' : '今回のお給料計算（自動）'}</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                            <span>お客様への総請求予定額（売上）</span>
                            <span className="font-semibold">{Math.floor(totals.totalSales).toLocaleString()} 円</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-b dark:border-gray-700lue-100/50 pt-2">
                            <span className="text-blue-800 font-medium">{isOwner ? 'オーナー売上（手数料なし）' : 'スタッフ様 取り分'}</span>
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

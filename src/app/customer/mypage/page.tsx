'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface HistoryItem {
    date: string;
    type: 'usage' | 'charge' | 'deposit_op';
    // 利用時
    staffName?: string;
    amount?: number;
    serviceSummary?: string;
    isPaid?: boolean;
    depositUsed?: number;
    billingAmount?: number;
    // チャージ・デポジット操作時
    chargeAmount?: number;
    bonusRate?: number;
    totalCharged?: number;
    depositType?: string;
    depositBalance?: number;
    // 通帳用残高
    runningBalance?: number;
    rowEffect?: number;
}

export default function CustomerMyPage() {
    const router = useRouter();
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [balance, setBalance] = useState<number | null>(null);
    const [unpaidTotal, setUnpaidTotal] = useState<number>(0);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<'all' | 'usage' | 'charge'>('all');

    const GAS_URL = 'https://script.google.com/macros/s/AKfycbzhzZLoVQRSYYykqnu88ebBtx79htz-3A7YDa3RgBKbjYJ-ie308nsQXhJflpEnNfuz0g/exec';

    const fetchMyPageData = useCallback(async (phone: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${GAS_URL}?action=getCustomerMyPage&phone=${encodeURIComponent(phone)}`);
            const data = await res.json();

            if (data.success) {
                setBalance(data.balance ?? 0);
                setUnpaidTotal(data.unpaidTotal ?? 0);
                setHistory(data.history ?? []);
                if (data.customerName) setCustomerName(data.customerName);
            } else {
                sessionStorage.clear();
                router.push('/customer/login');
            }
        } catch {
            console.error('データ取得エラー');
        } finally {
            setIsLoading(false);
        }
    }, [GAS_URL, router]);

    useEffect(() => {
        const phone = sessionStorage.getItem('customerPhone');
        const name = sessionStorage.getItem('customerName');
        if (!phone) {
            router.push('/customer/login');
            return;
        }
        setCustomerPhone(phone);
        if (name) setCustomerName(name);
        fetchMyPageData(phone);
    }, [router, fetchMyPageData]);

    const handleLogout = () => {
        sessionStorage.clear();
        router.push('/customer/login');
    };

    const filteredHistory = history.filter((item) => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'charge') return item.type === 'charge' || item.type === 'deposit_op';
        return item.type === activeFilter;
    });

    // 日付フォーマット
    const formatDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        } catch {
            return dateStr;
        }
    };

    // 入金額（正の金額）を取得
    const getCreditAmount = (item: HistoryItem): number => {
        if (item.type === 'charge' || item.type === 'deposit_op') {
            const dt = String(item.depositType || '');
            // 未払い調整: amount<0（未払い減）は入金側扱い
            if (dt.indexOf('未払い調整') === 0) {
                const amt = item.chargeAmount ?? 0;
                return amt < 0 ? Math.abs(amt) : 0;
            }
            const amt = item.chargeAmount ?? item.totalCharged ?? 0;
            return amt > 0 ? amt : 0;
        }
        return 0;
    };

    // 利用額（負の金額の絶対値）を取得
    const getDebitAmount = (item: HistoryItem): number => {
        if (item.type === 'usage') {
            return item.amount ?? 0;
        }
        if (item.type === 'charge' || item.type === 'deposit_op') {
            const dt = String(item.depositType || '');
            // 未払い調整: amount>0（未払い増）は利用側扱い
            if (dt.indexOf('未払い調整') === 0) {
                const amt = item.chargeAmount ?? 0;
                return amt > 0 ? amt : 0;
            }
            const amt = item.chargeAmount ?? 0;
            return amt < 0 ? Math.abs(amt) : 0;
        }
        return 0;
    };

    // 項目名を取得
    const getItemLabel = (item: HistoryItem): string => {
        if (item.type === 'usage') {
            return item.staffName ? `${item.staffName}との通話` : '利用';
        }
        if (item.depositType) {
            return item.depositType;
        }
        return 'デポジットチャージ';
    };

    // 決済方法ラベル
    const getPaymentLabel = (item: HistoryItem): string | null => {
        if (item.type !== 'usage') return null;
        if ((item.depositUsed ?? 0) > 0) {
            if ((item.billingAmount ?? 0) > 0) {
                return `デポジット¥${(item.depositUsed ?? 0).toLocaleString()} + 請求¥${(item.billingAmount ?? 0).toLocaleString()}`;
            }
            return 'デポジット充当';
        }
        if (item.isPaid) return '入金済';
        return '未入金';
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin h-8 w-8 border-3 border-[var(--border)] border-t-[var(--primary)] rounded-full" />
                    <p className="text-sm text-[var(--muted)]">読み込み中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--background)]">
            {/* ヘッダー */}
            <header className="sticky top-0 z-10 bg-[var(--surface)]/80 backdrop-blur-lg border-b border-[var(--border)]">
                <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
                    <div>
                        <h1 className="text-base font-bold text-[var(--foreground)]">マイページ</h1>
                        <p className="text-[11px] text-[var(--muted)]">
                            {customerName ? `${customerName} 様` : customerPhone}
                        </p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        ログアウト
                    </button>
                </div>
            </header>

            <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
                {/* 残高カード */}
                <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <p className="text-xs text-[var(--muted)] mb-1">デポジット残高</p>
                            <p className={`text-3xl font-bold tracking-tight ${(balance ?? 0) < 0 ? 'text-red-500' : 'text-[var(--foreground)]'}`}>
                                ¥{(balance ?? 0).toLocaleString()}
                            </p>
                        </div>
                        {unpaidTotal > 0 && (
                            <div className="text-right">
                                <p className="text-[10px] text-[var(--muted)] mb-1">未払い合計</p>
                                <p className="text-lg font-bold text-red-500">¥{unpaidTotal.toLocaleString()}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* フィルタータブ */}
                <div className="flex gap-1.5 bg-[var(--surface)] rounded-xl border border-[var(--border)] p-1">
                    {([
                        { key: 'all', label: 'すべて' },
                        { key: 'usage', label: '利用' },
                        { key: 'charge', label: 'チャ���ジ' },
                    ] as const).map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setActiveFilter(key)}
                            className={`flex-1 text-xs font-medium py-2 rounded-lg transition-all ${
                                activeFilter === key
                                    ? 'bg-[var(--primary)] text-white shadow-sm'
                                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* 通帳形式の履歴テ���ブル */}
                <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
                    {filteredHistory.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-sm text-[var(--muted)]">履歴がありません</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b border-[var(--border)] bg-gray-50/50 dark:bg-gray-900/30">
                                    <tr>
                                        <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[var(--muted)]">日付</th>
                                        <th className="text-left px-2 py-2.5 text-[11px] font-semibold text-[var(--muted)]">項目</th>
                                        <th className="text-right px-2 py-2.5 text-[11px] font-semibold text-blue-500">入金</th>
                                        <th className="text-right px-2 py-2.5 text-[11px] font-semibold text-red-400">利用</th>
                                        <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-[var(--muted)]">残高</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredHistory.map((item, idx) => {
                                        const credit = getCreditAmount(item);
                                        const debit = getDebitAmount(item);
                                        const itemBalance = item.runningBalance ?? 0;
                                        const paymentLabel = getPaymentLabel(item);
                                        // 残高が動かない行（過去分直接入金等）は残高列を非表示にする
                                        const hideBalance = (item.rowEffect ?? (credit - debit)) === 0;

                                        return (
                                            <tr
                                                key={idx}
                                                className={`border-b border-[var(--border)] last:border-b-0 ${
                                                    item.type !== 'usage' ? 'bg-blue-50/20 dark:bg-indigo-900/5' : ''
                                                }`}
                                            >
                                                <td className="px-3 py-2.5 text-[11px] text-[var(--muted)] whitespace-nowrap align-top">
                                                    {formatDate(item.date)}
                                                </td>
                                                <td className="px-2 py-2.5 align-top">
                                                    <p className="text-xs font-medium text-[var(--foreground)] leading-tight">
                                                        {getItemLabel(item)}
                                                    </p>
                                                    {item.type === 'usage' && item.serviceSummary && (
                                                        <p className="text-[10px] text-[var(--muted)] mt-0.5 leading-tight">{item.serviceSummary}</p>
                                                    )}
                                                    {paymentLabel && (
                                                        <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                                            item.isPaid || (item.depositUsed ?? 0) > 0
                                                                ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                                                : 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400'
                                                        }`}>
                                                            {paymentLabel}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2.5 text-right font-semibold text-blue-600 dark:text-blue-400 align-top whitespace-nowrap">
                                                    {credit > 0 ? `+¥${credit.toLocaleString()}` : ''}
                                                </td>
                                                <td className="px-2 py-2.5 text-right font-semibold text-red-500 align-top whitespace-nowrap">
                                                    {debit > 0 ? `-¥${debit.toLocaleString()}` : ''}
                                                </td>
                                                <td className={`px-3 py-2.5 text-right font-bold align-top whitespace-nowrap ${
                                                    hideBalance ? 'text-gray-300 dark:text-gray-600' : itemBalance < 0 ? 'text-red-500' : 'text-[var(--foreground)]'
                                                }`}>
                                                    {hideBalance ? '—' : `¥${itemBalance.toLocaleString()}`}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <p className="text-[10px] text-[var(--muted)] text-center">
                    残高はデポジット（前払い）の推移を表示しています
                </p>
            </main>
        </div>
    );
}

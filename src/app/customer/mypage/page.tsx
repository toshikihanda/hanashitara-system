'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface HistoryItem {
    date: string;
    type: 'usage' | 'charge';
    // 利用時
    staffName?: string;
    amount?: number;
    serviceSummary?: string;
    // チャージ時
    chargeAmount?: number;
    bonusRate?: number;
    totalCharged?: number;
}

export default function CustomerMyPage() {
    const router = useRouter();
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [balance, setBalance] = useState<number | null>(null);
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
                setHistory(data.history ?? []);
                if (data.customerName) setCustomerName(data.customerName);
            } else {
                // セッションが無効な場合はログインに戻す
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
                    <p className="text-xs text-[var(--muted)] mb-1">デポジット残高</p>
                    <p className="text-3xl font-bold text-[var(--foreground)] tracking-tight">
                        ¥{(balance ?? 0).toLocaleString()}
                    </p>
                </div>

                {/* フィルタータブ */}
                <div className="flex gap-1.5 bg-[var(--surface)] rounded-xl border border-[var(--border)] p-1">
                    {([
                        { key: 'all', label: 'すべて' },
                        { key: 'usage', label: '利用' },
                        { key: 'charge', label: 'チャージ' },
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

                {/* 履歴リスト */}
                <div className="space-y-2.5">
                    {filteredHistory.length === 0 ? (
                        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-8 text-center">
                            <p className="text-sm text-[var(--muted)]">履歴がありません</p>
                        </div>
                    ) : (
                        filteredHistory.map((item, idx) => (
                            <div
                                key={idx}
                                className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {/* アイコン */}
                                    <div
                                        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm ${
                                            item.type === 'charge'
                                                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                        }`}
                                    >
                                        {item.type === 'charge' ? '+' : '-'}
                                    </div>

                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-[var(--foreground)] truncate">
                                            {item.type === 'charge'
                                                ? 'デポジットチャージ'
                                                : item.staffName
                                                    ? `${item.staffName}との通話`
                                                    : '利用'}
                                        </p>
                                        <p className="text-[11px] text-[var(--muted)]">
                                            {formatDate(item.date)}
                                            {item.type === 'charge' && item.bonusRate
                                                ? ` ・還元${item.bonusRate}%`
                                                : ''}
                                            {item.type === 'usage' && item.serviceSummary
                                                ? ` ・${item.serviceSummary}`
                                                : ''}
                                        </p>
                                    </div>
                                </div>

                                {/* 金額 */}
                                <p
                                    className={`text-sm font-semibold flex-shrink-0 ml-3 ${
                                        item.type === 'charge'
                                            ? 'text-green-600 dark:text-green-400'
                                            : 'text-[var(--foreground)]'
                                    }`}
                                >
                                    {item.type === 'charge'
                                        ? `+¥${(item.totalCharged ?? item.chargeAmount ?? 0).toLocaleString()}`
                                        : `-¥${(item.amount ?? 0).toLocaleString()}`}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}

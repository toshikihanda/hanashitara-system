'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CustomerLoginPage() {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const GAS_URL = 'https://script.google.com/macros/s/AKfycbzhzZLoVQRSYYykqnu88ebBtx79htz-3A7YDa3RgBKbjYJ-ie308nsQXhJflpEnNfuz0g/exec';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!phone || !password) {
            setError('電話番号とパスワードを入力してください');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'customerLogin',
                    phone: phone.replace(/[-\s]/g, ''),
                    password,
                }),
            });
            const data = await res.json();

            if (data.success) {
                // セッション情報をsessionStorageに保存
                sessionStorage.setItem('customerPhone', data.phone);
                sessionStorage.setItem('customerName', data.customerName || '');
                router.push('/customer/mypage');
            } else {
                setError(data.message || '電話番号またはパスワードが正しくありません');
            }
        } catch {
            setError('通信エラーが発生しました。もう一度お試しください');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                {/* ロゴ・タイトル */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
                        ハナシタラ
                    </h1>
                    <p className="text-sm text-[var(--muted)] mt-1">マイページログイン</p>
                </div>

                {/* ログインカード */}
                <div className="bg-[var(--surface)] rounded-2xl shadow-sm border border-[var(--border)] p-6">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                                電話番号
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="090-1234-5678"
                                className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                                autoComplete="tel"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                                パスワード
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="パスワードを入力"
                                className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                                autoComplete="current-password"
                            />
                        </div>

                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs px-3 py-2 rounded-lg">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                                    ログイン中...
                                </span>
                            ) : (
                                'ログイン'
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-[10px] text-[var(--muted)] mt-6">
                    ログイン情報がわからない場合はスタッフにお問い合わせください
                </p>
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';

export default function BlacklistChecker() {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [blacklistedPhones, setBlacklistedPhones] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const GAS_URL = 'https://script.google.com/macros/s/AKfycbzopMne7Ga8ZruWAf3xvAP7WQFvQ-Uau09qsmG2K6-Mcs7xfrXXl1Ev4GmLHpOcgTwj/exec';

    useEffect(() => {
        // 初回のみブラックリストを取得
        fetch(`${GAS_URL}?action=getBlacklistPhones`)
            .then(res => res.json())
            .then(json => {
                if (json.success) {
                    setBlacklistedPhones(json.phones || []);
                }
            })
            .catch(err => console.error('ブラックリスト取得エラー:', err))
            .finally(() => setIsLoading(false));
    }, []);

    const isBlacklisted = phoneNumber && blacklistedPhones.includes(phoneNumber);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                📞 受付前ブラックリスト確認
            </h2>
            <p className="text-sm text-gray-500 mb-4">
                お客様から相談の依頼が来たら、まずここに電話番号を入力して対応可能か確認してください。
            </p>

            <div className="relative">
                <input
                    type="tel"
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono text-lg ${isBlacklisted ? 'border-red-400 bg-red-50 text-red-900' : 'border-gray-200'}`}
                    placeholder="電話番号を入力 (例: 09012345678)"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                />
                {isLoading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                        読込中...
                    </div>
                )}
            </div>

            {phoneNumber && !isLoading && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {isBlacklisted ? (
                        <div className="p-4 bg-red-100 text-red-800 rounded-xl border border-red-200 flex gap-3">
                            <span className="text-xl">⚠️</span>
                            <div>
                                <p className="font-bold text-lg mb-1">受診拒否対象（ブラックリスト）です</p>
                                <p className="text-sm opacity-90">このお客様からの相談はお断りするよう対応をお願いいたします。</p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-green-50 text-green-800 rounded-xl border border-green-200 flex flex-col justify-center items-center gap-1">
                            <p className="font-bold text-xl">✅ 対応可能です</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

import ReportForm from '@/components/ReportForm';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-800/50 pt-10 pb-20 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* ヘッダーエリア */}
        <header className="text-center space-y-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[#1c1c1e] dark:text-white tracking-tight mb-2">ハナシタラ.com</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">スタッフ専用ポータル</p>
          </div>
          <div className="flex justify-center">
            <Link
              href="/mypage"
              className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900 hover:text-gray-900 dark:text-gray-100 transition-colors"
            >
              📄 自分の給与・明細を確認する
            </Link>
          </div>
        </header>

        {/* 業務報告エリア */}
        <main className="space-y-6">
          <ReportForm />
        </main>

        <footer className="text-center pt-8 border-t border-gray-200 dark:border-gray-700/60 text-xs text-gray-400 dark:text-gray-500">
          <p>© 2026 ハナシタラ.com All Rights Reserved.</p>
        </footer>
      </div>
    </div>
  );
}

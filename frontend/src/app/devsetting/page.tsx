"use client";

import { useEffect, useState } from 'react';

export default function DevSettingPage() {
  const [tables, setTables] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/dev/tables');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: string[] = await response.json();
        setTables(data);
        setError(null);
      } catch (e: any) {
        setError(e.message || 'Failed to fetch tables.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchTables();
  }, []);

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl text-[color:var(--ink-900)] mb-6">Developer Settings</h1>
      
      <div className="sage-panel p-6">
        <h2 className="text-2xl font-semibold mb-4 text-[color:var(--ink-900)]">Database Tables</h2>
        {loading && <p>Loading tables...</p>}
        {error && <p className="text-red-500">Error: {error}</p>}
        
        {!loading && !error && (
          <ul className="space-y-2">
            {tables && tables.length > 0 ? (
              tables.map(table => (
                <li 
                  key={table}
                  className="p-3 bg-[color:var(--sand-50)] rounded-md cursor-pointer hover:bg-[color:var(--sand-100)]"
                >
                  {table}
                </li>
              ))
            ) : (
              <p>No tables found in the public schema.</p>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

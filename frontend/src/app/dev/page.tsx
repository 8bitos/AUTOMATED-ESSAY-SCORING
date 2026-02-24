"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import NoticeDialog from '@/components/ui/NoticeDialog';

interface User {
    id: string;
    nama_lengkap: string;
    email: string;
    peran: string;
    username?: string;
}

interface ApiResponse {
    status: number;
    message?: string;
    data?: any;
    error?: string;
}

const API_BASE_URL = '/api'; // Use Next.js proxy

const DevPage: React.FC = () => {
    const { user, isAuthenticated, loading, login, logout } = useAuth();
    const router = useRouter();

    const [output, setOutput] = useState<ApiResponse | null>(null);
    const [loginIdentifier, setLoginIdentifier] = useState('teacher1');
    const [loginPassword, setLoginPassword] = useState('password');

    // Generic state for API inputs
    const [resource, setResource] = useState('classes');
    const [resourceId, setResourceId] = useState('');
    const [requestBody, setRequestBody] = useState('{}');
    const [loginSuccessOpen, setLoginSuccessOpen] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: loginIdentifier, password: loginPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                setOutput({ status: res.status, error: data.message || 'Login failed' });
                return;
            }
            await login(data); // Pass user data to context
            setOutput({ status: res.status, data: data });
            setLoginSuccessOpen(true);
            router.push('/dev'); // Stay on dev page
        } catch (err: any) {
            setOutput({ status: 500, error: err.message });
        }
    };

    const handleApiCall = useCallback(async (method: string, path: string, body?: any) => {
        setOutput(null); // Clear previous output
        try {
            const options: RequestInit = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
            };
            if (body) {
                options.body = JSON.stringify(body);
            }

            const res = await fetch(`${API_BASE_URL}/${path}`, options);
            const data = await res.json();

            if (!res.ok) {
                setOutput({ status: res.status, error: data.message || 'API call failed' });
            } else {
                setOutput({ status: res.status, data: data });
            }
        } catch (err: any) {
            setOutput({ status: 500, error: err.message });
        }
    }, []);

    const handleFormSubmit = (e: React.FormEvent, method: string) => {
        e.preventDefault();
        let path = resource;
        let body: any = {};

        try {
            body = JSON.parse(requestBody);
        } catch (e) {
            setOutput({ status: 400, error: 'Invalid JSON for request body' });
            return;
        }

        if (resourceId) {
            path = `${resource}/${resourceId}`;
        }
        
        // Specific paths for nested resources
        if (resource === 'classes' && resourceId && body.students) { // Example for adding student to class
            // This would require a specific endpoint not yet created
            setOutput({ status: 400, error: 'Adding students to class not implemented via generic endpoint' });
            return;
        }

        handleApiCall(method, path, body);
    };


    if (loading) {
        return <div className="p-4">Loading authentication...</div>;
    }

    return (
        <>
        <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Backend API Dev Tool</h1>

            {/* Authentication Section */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Authentication</h2>
                {!isAuthenticated ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Identifier (Username/Email)</label>
                            <input
                                type="text"
                                value={loginIdentifier}
                                onChange={(e) => setLoginIdentifier(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-transparent focus:ring-[color:var(--sage-500)]"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Password</label>
                            <input
                                type="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-transparent focus:ring-[color:var(--sage-500)]"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[color:var(--sage-700)] hover:bg-[color:var(--sage-800)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[color:var(--sage-500)]"
                        >
                            Login
                        </button>
                    </form>
                ) : (
                    <div>
                        <p className="text-gray-600">Logged in as: <span className="font-medium">{user?.nama_lengkap} ({user?.peran})</span></p>
                        <button
                            onClick={logout}
                            className="mt-4 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                            Logout
                        </button>
                    </div>
                )}
            </div>

            {/* API Explorer Section */}
            {isAuthenticated && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">API Explorer</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Resource Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Select Resource</label>
                            <select
                                value={resource}
                                onChange={(e) => { setResource(e.target.value); setResourceId(''); setRequestBody('{}'); }}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-transparent focus:ring-[color:var(--sage-500)]"
                            >
                                <option value="users">users</option> {/* Auth is handled separately */}
                                <option value="classes">classes</option>
                                <option value="materials">materials</option>
                                <option value="essay-questions">essay-questions</option>
                                <option value="rubrics">rubrics</option>
                                <option value="submissions">submissions</option>
                                <option value="ai-results">ai-results</option>
                                <option value="teacher-reviews">teacher-reviews</option>
                                {/* Add more resources as needed */}
                            </select>
                        </div>

                        {/* Resource ID Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Resource ID (for GET by ID, PUT, DELETE)</label>
                            <input
                                type="text"
                                value={resourceId}
                                onChange={(e) => setResourceId(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-transparent focus:ring-[color:var(--sage-500)]"
                                placeholder="e.g., d5c3e2a1-..."
                            />
                        </div>
                    </div>

                    {/* Request Body Input */}
                    <div className="mt-6">
                        <label className="block text-sm font-medium text-gray-700">Request Body (JSON for POST/PUT)</label>
                        <textarea
                            value={requestBody}
                            onChange={(e) => setRequestBody(e.target.value)}
                            rows={6}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-transparent focus:ring-[color:var(--sage-500)] font-mono"
                            placeholder='{"class_name": "New Class", "deskripsi": "Description here"}'
                        ></textarea>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                        <button
                            onClick={() => handleApiCall('GET', resource + (resourceId ? `/${resourceId}` : ''))}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                        >
                            GET {resourceId ? 'By ID' : 'All'}
                        </button>
                        <button
                            onClick={(e) => handleFormSubmit(e, 'POST')}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[color:var(--sage-700)] hover:bg-[color:var(--sage-800)]"
                        >
                            POST
                        </button>
                        <button
                            onClick={(e) => handleFormSubmit(e, 'PUT')}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
                            disabled={!resourceId}
                        >
                            PUT
                        </button>
                        <button
                            onClick={() => handleApiCall('DELETE', `${resource}/${resourceId}`)}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                            disabled={!resourceId}
                        >
                            DELETE
                        </button>
                         <button
                            onClick={() => handleApiCall('GET', `classes/${resourceId}/students`)}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                            disabled={resource !== 'classes' || !resourceId}
                        >
                            GET Students (Class)
                        </button>
                         <button
                            onClick={() => handleApiCall('GET', `classes/${resourceId}/materials`)}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                            disabled={resource !== 'classes' || !resourceId}
                        >
                            GET Materials (Class)
                        </button>
                        <button
                            onClick={() => handleApiCall('GET', `materials/${resourceId}/essay-questions`)}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                            disabled={resource !== 'materials' || !resourceId}
                        >
                            GET Questions (Material)
                        </button>
                        <button
                            onClick={() => handleApiCall('GET', `essay-questions/${resourceId}/rubrics`)}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                            disabled={resource !== 'essay-questions' || !resourceId}
                        >
                            GET Rubrics (Question)
                        </button>
                        <button
                            onClick={() => handleApiCall('GET', `essay-questions/${resourceId}/submissions`)}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                            disabled={resource !== 'essay-questions' || !resourceId}
                        >
                            GET Submissions (Question)
                        </button>
                         <button
                            onClick={() => handleApiCall('GET', `submissions/${resourceId}/ai-result`)}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                            disabled={resource !== 'submissions' || !resourceId}
                        >
                            GET AI Result (Submission)
                        </button>
                         <button
                            onClick={() => handleApiCall('GET', `submissions/${resourceId}/teacher-review`)}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                            disabled={resource !== 'submissions' || !resourceId}
                        >
                            GET Teacher Review (Submission)
                        </button>
                    </div>

                    {/* Output */}
                    {output && (
                        <div className="mt-6 p-4 rounded-md font-mono text-sm bg-gray-50 border border-gray-200">
                            <h3 className="font-semibold text-gray-800 mb-2">Response ({output.status})</h3>
                            {output.error && <pre className="text-red-500 whitespace-pre-wrap">{output.error}</pre>}
                            {output.data && <pre className="text-green-700 whitespace-pre-wrap">{JSON.stringify(output.data, null, 2)}</pre>}
                        </div>
                    )}
                </div>
            )}
        </div>
        <NoticeDialog
            isOpen={loginSuccessOpen}
            title="Login Berhasil"
            message="Sesi dev berhasil dibuat."
            tone="success"
            onClose={() => setLoginSuccessOpen(false)}
        />
        </>
    );
};

export default DevPage;

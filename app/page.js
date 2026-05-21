'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';

const MANAGERS = ['xyz@gmail.com', 'aa@vitstudent.ac.in', 'abc@gmail.com'];
const ADMINS = ['liki123456m@gmail.com'];
const DEFAULT_DATES = [
  { value: '07-05-26', label: '07-05-26'  },
  { value: '08-05-26', label: '08-05-26' },
];

const statusClass = {
  Present: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  Absent: 'text-rose-700 bg-rose-50 border-rose-200',
  Coming: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Not Coming': 'text-rose-700 bg-rose-50 border-rose-200',
  'VTOP Applied': 'text-blue-700 bg-blue-50 border-blue-200',
  'Not Applied': 'text-amber-700 bg-amber-50 border-amber-200',
  '': 'text-slate-500 bg-white border-slate-200',
};

function Stat({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-900 border-slate-200',
    green: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    blue: 'bg-blue-50 text-blue-900 border-blue-200',
    amber: 'bg-amber-50 text-amber-900 border-amber-200',
  };

  return (
    <div className={`rounded-lg border px-4 py-3 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function StatusSelect({ value, disabled, onChange, accent = 'blue', options }) {
  const ring = accent === 'green' ? 'focus:ring-emerald-500' : 'focus:ring-blue-500';
  const choices = options || ['Present', 'Absent'];

  return (
    <select
      value={value || ''}
      disabled={disabled}
      onChange={onChange}
      className={`h-9 w-full rounded-md border px-2 text-center text-sm font-medium outline-none transition ${statusClass[value || '']} ${ring} focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200`}
    >
      <option value="">Select</option>
      {choices.map((choice) => (
        <option key={choice} value={choice}>{choice}</option>
      ))}
    </select>
  );
}

function formatDateSegment(value) {
  const [year, month, day] = value.split('-');
  return `${day}-${month}-${year.slice(-2)}`;
}

function parseDateSegment(value) {
  const [day, month, year] = value.split('-').map(Number);
  if (!day || !month || Number.isNaN(year)) return 0;
  return new Date(2000 + year, month - 1, day).getTime();
}

function sortDateOptions(dates) {
  return [...dates].sort((a, b) => parseDateSegment(b.value) - parseDateSegment(a.value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function Dashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [participantDrafts, setParticipantDrafts] = useState({});
  const [dateOptions, setDateOptions] = useState(DEFAULT_DATES);
  const [selectedDate, setSelectedDate] = useState('07-05-26');
  const [newDate, setNewDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [manualUser, setManualUser] = useState({ name: '', email: '', reg_no: '', role: 'participant' });
  const [editingUser, setEditingUser] = useState(null);
  const [addingManual, setAddingManual] = useState(false);

  const fetchDates = useCallback(async () => {
    const res = await fetch('/api/dates');
    const data = await res.json();
    const dates = sortDateOptions(data.dates?.length ? data.dates : DEFAULT_DATES);
    setDateOptions(dates);
    setSelectedDate((currentDate) => dates.some((date) => date.value === currentDate) ? currentDate : dates[0]?.value || '');

    if (!res.ok) setImportMessage(`Error: ${data.error}`);
  }, []);

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    let merged = [];
    if (user && !authError) {
      setUser(user);
      await fetchDates();

      const profilesRes = await fetch('/api/profiles');
      const profilesData = await profilesRes.json();
      const profiles = profilesData.profiles || [];

      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('date_string', selectedDate);

      merged = profiles.map((profile) => {
        const att = attendance?.find((a) => a.profile_id === profile.id) || {};
        return {
          id: att.id || `temp-${profile.id}`,
          profile_id: profile.id,
          date_string: selectedDate,
          coming: att.coming || null,
          request: att.request || null,
          attendance_1: att.attendance_1 || null,
          attendance_2: att.attendance_2 || null,
          profiles: profile,
        };
      });

      setRecords(merged);
    } else {
      setUser(null);
      setRecords([]);
    }

    if (!silent) setLoading(false);
    return merged;
  }, [fetchDates, selectedDate, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user) return undefined;

    const intervalId = window.setInterval(() => {
      fetchData({ silent: true });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [fetchData, user]);

  const emailClean = user?.email?.toLowerCase().trim() || '';
  const isAdmin = ADMINS.includes(emailClean);
  const isManager = MANAGERS.includes(emailClean);
  const currentRole = isAdmin ? 'Admin' : isManager ? 'Manager' : 'Participant';

  const stats = useMemo(() => {
    const total = records.length;
    const coming = records.filter((row) => row.coming === 'Coming').length;
    const requested = records.filter((row) => row.request === 'VTOP Applied').length;
    const marked = records.filter((row) => row.attendance_1 || row.attendance_2).length;
    return { total, coming, requested, marked };
  }, [records]);

  const handleCellChange = async (recordId, targetProfileId, columnName, newValue) => {
    const previousRecords = [...records];
    setRecords(records.map((r) => (r.profiles.id === targetProfileId ? { ...r, [columnName]: newValue } : r)));

    const res = await fetch('/api/attendance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordId,
        targetProfileId,
        dateString: selectedDate,
        updates: { [columnName]: newValue },
      }),
    });

    const result = await res.json();
    if (!res.ok || result.error) {
      const message = result.error || 'Failed to save update.';
      alert(`Access denied: ${message}`);
      setRecords(previousRecords);
    }
  };

  const getDraftKey = (profileId) => `${selectedDate}:${profileId}`;

  const getDraftValue = (row, columnName) => {
    const draft = participantDrafts[getDraftKey(row.profiles.id)];
    return draft?.[columnName] ?? row[columnName];
  };

  const handleParticipantDraftChange = (profileId, columnName, newValue) => {
    const key = getDraftKey(profileId);
    setParticipantDrafts((drafts) => ({
      ...drafts,
      [key]: {
        ...(drafts[key] || {}),
        [columnName]: newValue,
      },
    }));
  };

  const handleParticipantSave = async (row) => {
    const key = getDraftKey(row.profiles.id);
    const draft = participantDrafts[key] || {};
    const updates = {};

    if (!row.coming && draft.coming) updates.coming = draft.coming;
    if (!row.request && draft.request) updates.request = draft.request;

    if (Object.keys(updates).length === 0) {
      setImportMessage('Choose a value before saving.');
      return;
    }

    const previousRecords = [...records];
    setRecords(records.map((record) => (
      record.profiles.id === row.profiles.id ? { ...record, ...updates } : record
    )));

    const res = await fetch('/api/attendance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordId: row.id,
        targetProfileId: row.profiles.id,
        dateString: selectedDate,
        updates,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      setRecords(previousRecords);
      setImportMessage(`Error: ${data.error || 'Failed to save update.'}`);
      return;
    }

    setParticipantDrafts((drafts) => {
      const nextDrafts = { ...drafts };
      delete nextDrafts[key];
      return nextDrafts;
    });
    setImportMessage('Saved. Participants cannot edit saved choices.');
  };

  const downloadPDF = async (rows) => {
    setImportMessage('Preparing PDF download...');
    try {
      if (typeof window === 'undefined') return;

      // Load jspdf UMD module from CDN if not already loaded
      if (!window.jspdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // Load jspdf-autotable plugin if not already loaded
      if (window.jspdf && !window.jspdf.jsPDF.API.autoTable) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Attendance Report', 14, 20);

      // Metadata
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105); // text-slate-500
      doc.text(`Date: ${selectedDate}`, 14, 28);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34);
      doc.text(`Generated by: ${user.email}`, 14, 40);

      // Table headers & rows
      const headers = [['#', 'Name', 'Email', 'Reg No.', 'Role', 'Coming', 'Request', 'Attendance 1', 'Attendance 2']];
      const data = rows.map((row, index) => [
        index + 1,
        row.profiles.name || '',
        row.profiles.email || '',
        row.profiles.reg_no || '-',
        row.profiles.role || '',
        row.coming || '',
        row.request || '',
        row.attendance_1 || '',
        row.attendance_2 || '',
      ]);

      doc.autoTable({
        startY: 46,
        head: headers,
        body: data,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] }, // slate-900
        alternateRowStyles: { fillColor: [248, 250, 252] }, // slate-50
        styles: { 
          fontSize: 9, 
          cellPadding: 3,
          lineColor: [226, 232, 240], // slate-200
          lineWidth: 0.1
        },
        columnStyles: {
          0: { cellWidth: 12 }, // #
          1: { cellWidth: 45 }, // Name
          2: { cellWidth: 60 }, // Email
          3: { cellWidth: 25 }, // Reg No
          4: { cellWidth: 20 }, // Role
          5: { cellWidth: 25 }, // Coming
          6: { cellWidth: 25 }, // Request
          7: { cellWidth: 28 }, // Attendance 1
          8: { cellWidth: 28 }  // Attendance 2
        }
      });

      doc.save(`Attendance-Report-${selectedDate}.pdf`);
      setImportMessage('All rows saved. PDF report downloaded.');
    } catch (err) {
      console.error('Error generating PDF:', err);
      setImportMessage('Failed to download PDF. Please check connection.');
    }
  };

  const handleSaveAllAndPdf = async () => {
    setImportMessage('Saving all rows...');

    const responses = await Promise.all(records.map(async (row) => {
      const updates = {
        coming: row.coming || null,
        request: row.request || null,
        attendance_1: row.attendance_1 || null,
        attendance_2: row.attendance_2 || null,
      };

      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: row.id,
          targetProfileId: row.profiles.id,
          dateString: selectedDate,
          updates,
        }),
      });
      const data = await res.json();
      return { ok: res.ok && !data.error, error: data.error };
    }));

    const failed = responses.find((response) => !response.ok);
    if (failed) {
      setImportMessage(`Error: ${failed.error || 'Failed to save all rows.'}`);
      return;
    }

    setImportMessage('All rows saved. PDF report downloading...');
    const latestRecords = await fetchData({ silent: true });
    await downloadPDF(latestRecords || records);
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    setImportMessage('Parsing CSV...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const rows = text.split('\n');

      if (rows.length < 2) {
        setImportMessage('CSV must contain a header row and at least one data row.');
        setImporting(false);
        return;
      }

      const headers = rows[0].split(',').map((h) => h.trim().toLowerCase());
      const users = [];

      for (let i = 1; i < rows.length; i++) {
        if (!rows[i].trim()) continue;
        const cols = rows[i].split(',');
        const userObj = {};
        headers.forEach((h, index) => {
          userObj[h] = cols[index]?.trim() || '';
        });
        if (userObj.email && userObj.name) users.push(userObj);
      }

      if (users.length === 0) {
        setImportMessage('No valid users found. Headers must include name and email.');
        setImporting(false);
        return;
      }

      setImportMessage(`Importing ${users.length} users...`);

      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users }),
        });
        const data = await res.json();

        if (res.ok) {
          setImportMessage(data.message + (data.errors ? ' Some rows need review.' : ''));
          if (data.errors) console.error(data.errors);
          await fetchData();
        } else {
          setImportMessage(`Error: ${data.error}`);
        }
      } catch (err) {
        setImportMessage('Failed to connect to import API.');
      }

      setImporting(false);
      e.target.value = '';
    };

    reader.readAsText(file);
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!manualUser.name || !manualUser.email) return;

    setAddingManual(true);
    setImportMessage('Adding user...');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: [manualUser] }),
      });
      const data = await res.json();

      if (res.ok) {
        setImportMessage(`Added ${manualUser.name} successfully.`);
        setManualUser({ name: '', email: '', reg_no: '', role: 'participant' });
        await fetchData();
      } else {
        setImportMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setImportMessage('Failed to add user.');
    }

    setAddingManual(false);
  };

  const handleAddDate = async (e) => {
    e.preventDefault();
    if (!newDate) return;

    const formattedDate = formatDateSegment(newDate);
    if (dateOptions.some((date) => date.value === formattedDate)) {
      setSelectedDate(formattedDate);
      setNewDate('');
      setImportMessage('Date already exists.');
      return;
    }

    const res = await fetch('/api/dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateString: formattedDate, label: formattedDate, helper: 'Added Date' }),
    });
    const data = await res.json();

    if (!res.ok) {
      setImportMessage(`Error: ${data.error}`);
      return;
    }

    await fetchDates();
    setSelectedDate(formattedDate);
    setNewDate('');
    setImportMessage('Date added for all users.');
  };

  const handleDeleteDate = async () => {
    if (dateOptions.length <= 1) {
      setImportMessage('Keep at least one date segment.');
      return;
    }

    if (!selectedDate) {
      setImportMessage('Select a date to delete.');
      return;
    }

    if (!window.confirm(`Delete ${selectedDate} and its attendance records?`)) return;

    const res = await fetch(`/api/dates?date=${encodeURIComponent(selectedDate)}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      setImportMessage(`Error: ${data.error}`);
      return;
    }

    await fetchDates();
    setImportMessage('Date deleted for all users.');
  };

  const handleSaveUser = async () => {
    if (!editingUser?.name || !editingUser?.email) return;

    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingUser),
    });
    const data = await res.json();

    if (!res.ok) {
      setImportMessage(`Error: ${data.error}`);
      return;
    }

    setEditingUser(null);
    setImportMessage('User updated.');
    await fetchData();
  };

  const handleDeleteUser = async (profile) => {
    if (!window.confirm(`Delete ${profile.name} and all of their attendance records?`)) return;

    const res = await fetch(`/api/admin/users?id=${encodeURIComponent(profile.id)}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      setImportMessage(`Error: ${data.error}`);
      return;
    }

    setImportMessage('User deleted.');
    await fetchData();
  };

  const handleExportExcel = async () => {
    setExporting(true);
    setImportMessage('Preparing Excel export...');

    try {
      const profilesRes = await fetch('/api/profiles');
      const profilesData = await profilesRes.json();
      const profiles = profilesData.profiles || [];
      const dateValues = dateOptions.map((date) => date.value);

      const { data: attendance = [] } = await supabase
        .from('attendance')
        .select('*')
        .in('date_string', dateValues);

      const sections = dateOptions.map((date) => {
        const rows = profiles.map((profile) => {
          const att = attendance.find((item) => item.profile_id === profile.id && item.date_string === date.value) || {};
          return `
            <tr>
              <td>${escapeHtml(profile.name)}</td>
              <td>${escapeHtml(profile.email)}</td>
              <td>${escapeHtml(profile.reg_no || '-')}</td>
              <td>${escapeHtml(profile.role)}</td>
              <td>${escapeHtml(att.coming || '')}</td>
              <td>${escapeHtml(att.request || '')}</td>
              <td>${escapeHtml(att.attendance_1 || '')}</td>
              <td>${escapeHtml(att.attendance_2 || '')}</td>
            </tr>
          `;
        }).join('');

        return `
          <h2>Attendance Registry - ${escapeHtml(date.value)}</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Reg No.</th>
                <th>Role</th>
                <th>Coming</th>
                <th>Request</th>
                <th>Attendance 1</th>
                <th>Attendance 2</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <br />
        `;
      }).join('');

      const workbook = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Arial, sans-serif; color: #0f172a; }
              h2 { margin: 18px 0 8px; font-size: 18px; }
              table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
              th { background: #0f172a; color: #ffffff; font-weight: 700; }
              th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; }
              tr:nth-child(even) td { background: #f8fafc; }
            </style>
          </head>
          <body>${sections}</body>
        </html>
      `;

      const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-export-${new Date().toISOString().slice(0, 10)}.xls`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setImportMessage('Excel export ready.');
    } catch (err) {
      setImportMessage('Failed to export Excel file.');
    }

    setExporting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-600 shadow-sm">
          Loading attendance workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Session expired or unauthorized</p>
          <a href="/login" className="mt-3 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Go to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">AR</div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Attendance Registry</h1>
              <p className="text-sm text-slate-500">Clean spreadsheet control with protected role-based editing.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="font-medium text-slate-800">{user.email}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{currentRole} view</p>
            </div>
            <button
              onClick={() => fetchData({ silent: true })}
              className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Refresh
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-3 py-4 sm:px-6 sm:py-5">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="People" value={stats.total} />
          <Stat label="Coming" value={stats.coming} tone="green" />
          <Stat label="VTOP Applied" value={stats.requested} tone="blue" />
          <Stat label="Attendance Marked" value={stats.marked} tone="amber" />
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-900">Date segment</p>
            <p className="text-sm text-slate-500">
              {isAdmin ? 'All fields are open for admin editing.' : 'Protected fields are enforced by the server.'}
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {dateOptions.map((date) => (
                  <option key={date.value} value={date.value}>
                    {date.label} ({date.helper})
                  </option>
                ))}
              </select>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={handleDeleteDate}
                    className="h-10 rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                  >
                    Delete Date
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={exporting}
                    className="h-10 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
                  >
                    {exporting ? 'Exporting...' : 'Export Excel'}
                  </button>
                </>
              )}
              {(isAdmin || isManager) && (
                <button
                  type="button"
                  onClick={handleSaveAllAndPdf}
                  className="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  Save All + PDF
                </button>
              )}
            </div>

            {isAdmin && (
              <form onSubmit={handleAddDate} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Add date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <button type="submit" className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  Add Date
                </button>
              </form>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-2 text-xs font-medium text-slate-500 sm:hidden">
            Swipe sideways to view all attendance columns.
          </div>
          <div className="-mx-3 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="w-[190px] px-4 py-3">Name</th>
                  <th className="w-[250px] px-4 py-3">Email</th>
                  <th className="w-[120px] px-4 py-3">Reg No.</th>
                  <th className="w-[110px] px-4 py-3 text-center">Role</th>
                  <th className="w-[130px] px-3 py-3 text-center">Coming</th>
                  <th className="w-[130px] px-3 py-3 text-center">Request</th>
                  <th className="w-[145px] px-3 py-3 text-center">Attendance 1</th>
                  <th className="w-[145px] px-3 py-3 text-center">Attendance 2</th>
                  {!isAdmin && !isManager && <th className="w-[110px] px-3 py-3 text-center">Save</th>}
                  {isAdmin && <th className="w-[150px] px-3 py-3 text-center">Manage</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 9 : !isManager ? 9 : 8} className="px-4 py-12 text-center text-slate-500">
                      No user records found for this date.
                    </td>
                  </tr>
                ) : (
                  records.map((row) => {
                    const isOwnRow = row.profiles.id === user.id;
                    const isParticipant = !isAdmin && !isManager;
                    const canEditComing = isAdmin || isManager || (isParticipant && isOwnRow && !row.coming);
                    const canEditRequest = isAdmin || isManager || (isParticipant && isOwnRow && !row.request);
                    const canEditAttendance = isAdmin || isManager;
                    const isEditing = editingUser?.id === row.profiles.id;
                    const draft = participantDrafts[getDraftKey(row.profiles.id)] || {};
                    const canSaveParticipant = isParticipant && isOwnRow && ((!row.coming && draft.coming) || (!row.request && draft.request));

                    return (
                      <tr key={row.id} className="bg-white transition hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {isEditing ? (
                            <input value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm" />
                          ) : (
                            <div className="truncate">{row.profiles.name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {isEditing ? (
                            <input type="email" value={editingUser.email} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm" />
                          ) : (
                            <div className="truncate">{row.profiles.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {isEditing ? (
                            <input value={editingUser.reg_no || ''} onChange={(e) => setEditingUser({ ...editingUser, reg_no: e.target.value })} className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm" />
                          ) : (
                            row.profiles.reg_no || '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <select value={editingUser.role} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
                              <option value="participant">Participant</option>
                              <option value="manager">Manager</option>
                              <option value="core">Core</option>
                            </select>
                          ) : (
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
                              {row.profiles.role}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <StatusSelect
                            value={isParticipant && isOwnRow ? getDraftValue(row, 'coming') : row.coming}
                            disabled={!canEditComing}
                            options={['Coming', 'Not Coming']}
                            onChange={(e) => {
                              if (isParticipant) {
                                handleParticipantDraftChange(row.profiles.id, 'coming', e.target.value);
                              } else {
                                handleCellChange(row.id, row.profiles.id, 'coming', e.target.value);
                              }
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <StatusSelect
                            value={isParticipant && isOwnRow ? getDraftValue(row, 'request') : row.request}
                            disabled={!canEditRequest}
                            options={['VTOP Applied', 'Not Applied']}
                            onChange={(e) => {
                              if (isParticipant) {
                                handleParticipantDraftChange(row.profiles.id, 'request', e.target.value);
                              } else {
                                handleCellChange(row.id, row.profiles.id, 'request', e.target.value);
                              }
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <StatusSelect
                            value={row.attendance_1}
                            disabled={!canEditAttendance}
                            accent="green"
                            onChange={(e) => handleCellChange(row.id, row.profiles.id, 'attendance_1', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <StatusSelect
                            value={row.attendance_2}
                            disabled={!canEditAttendance}
                            accent="green"
                            onChange={(e) => handleCellChange(row.id, row.profiles.id, 'attendance_2', e.target.value)}
                          />
                        </td>
                        {!isAdmin && !isManager && (
                          <td className="px-3 py-2 text-center">
                            {isOwnRow ? (
                              <button
                                type="button"
                                onClick={() => handleParticipantSave(row)}
                                disabled={!canSaveParticipant}
                                className="h-9 rounded-md bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500"
                              >
                                Save
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">Locked</span>
                            )}
                          </td>
                        )}
                        {isAdmin && (
                          <td className="px-3 py-2">
                            {isEditing ? (
                              <div className="flex justify-center gap-2">
                                <button type="button" onClick={handleSaveUser} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">Save</button>
                                <button type="button" onClick={() => setEditingUser(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                              </div>
                            ) : (
                              <div className="flex justify-center gap-2">
                                <button type="button" onClick={() => setEditingUser({ id: row.profiles.id, name: row.profiles.name, email: row.profiles.email, reg_no: row.profiles.reg_no || '', role: row.profiles.role || 'participant' })} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Edit</button>
                                <button type="button" onClick={() => handleDeleteUser(row.profiles)} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100">Delete</button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {isAdmin && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700">Admin only</span>
                  <h2 className="text-base font-semibold">Identity Management</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">CSV headers: name, email, reg_no, role. New users get password: name@123.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {importMessage && <p className="text-sm font-medium text-slate-600">{importMessage}</p>}
                <label className={`inline-flex h-10 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-medium transition ${importing ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-700'}`}>
                  {importing ? 'Processing...' : 'Upload CSV'}
                  <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} disabled={importing} />
                </label>
              </div>
            </div>

            <form onSubmit={handleManualAdd} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_130px_160px_auto] lg:items-end">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name *</label>
                <input type="text" required value={manualUser.name} onChange={(e) => setManualUser({ ...manualUser, name: e.target.value })} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="John Doe" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email *</label>
                <input type="email" required value={manualUser.email} onChange={(e) => setManualUser({ ...manualUser, email: e.target.value })} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="john@example.com" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Reg No</label>
                <input type="text" value={manualUser.reg_no} onChange={(e) => setManualUser({ ...manualUser, reg_no: e.target.value })} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="101" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Role</label>
                <select value={manualUser.role} onChange={(e) => setManualUser({ ...manualUser, role: e.target.value })} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                  <option value="participant">Participant</option>
                  <option value="manager">Manager</option>
                  <option value="core">Core</option>
                </select>
              </div>
              <button type="submit" disabled={addingManual} className="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:bg-slate-300">
                {addingManual ? 'Adding...' : 'Add User'}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}

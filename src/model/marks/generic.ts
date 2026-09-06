import type { LogoCategory, LogoEntry } from '../logoRegistry';

/**
 * GENERIC CATEGORY MARKS — hand-authored, original, monochrome.
 *
 * One 24×24 path per entry, drawn with `currentColor` strokes (see `PathMark`),
 * so a mark inherits the node's colour, reads in both MUI themes and survives
 * the per-element accent override. Nothing here is a vendor logo: these say what
 * KIND of thing an element is ("a queue", "a report", "a firewall"), which is
 * what most boxes on a landscape actually need. Real brands live in
 * `marks/vendors.ts`; the rail set is a registered pack (`app/iconPacks/rail.ts`).
 *
 * Drawing rules, so additions keep looking like the rest:
 * - 24×24 box, roughly 3…21 of usable room, stroke width 2, round caps/joins.
 * - ONE path string, subpaths separated by a new `M`. No fills — a filled dot
 *   at 14 px is a blob, and a single path cannot mix fill and stroke anyway.
 * - Legible at 14 px first, pretty at 28 px second. If a shape needs more than
 *   five subpaths to read, it is the wrong shape.
 *
 * Keys are PERSISTED (`DesignElement.iconKey`, and the interchange `iconType`
 * vocabulary), so they never change — the eight original keys (`database`,
 * `queue`, `api`, `cache`, `storage`, `cdn`, `scheduler`, `auth`) are kept
 * exactly as they were even where the drawing was redone as a single path.
 *
 * Keywords carry the Dutch words a Dutch team will actually type; the picker's
 * search is diacritics- and case-insensitive over label + keywords.
 */

const mark = (
  key: string,
  label: string,
  category: LogoCategory,
  keywords: string[],
  path: string,
): LogoEntry => ({ key, label, category, keywords, path, render: 'stroke' });

// --- data ---------------------------------------------------------------------

const DATA: LogoEntry[] = [
  mark('database', 'Database', 'data', ['db', 'sql', 'gegevens', 'tabel', 'opslag'],
    'M5 6a7 3 0 1 0 14 0a7 3 0 1 0-14 0M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3'),
  mark('data-warehouse', 'Data warehouse', 'data', ['dwh', 'datawarehouse', 'rapportage', 'bi', 'kubus'],
    'M3 9l9-5 9 5M5 9v11h14V9M9 13h6M9 17h6'),
  mark('data-lake', 'Data lake', 'data', ['lake', 'datameer', 'ruwe data', 'ongestructureerd'],
    'M3 7c2-1.7 4-1.7 6 0s4 1.7 6 0 4-1.7 6 0M3 12.5c2-1.7 4-1.7 6 0s4 1.7 6 0 4-1.7 6 0M3 18c2-1.7 4-1.7 6 0s4 1.7 6 0 4-1.7 6 0'),
  mark('cache', 'Cache', 'data', ['cache', 'tussenopslag', 'snel', 'geheugen'],
    'M13 3L5 13.5h5.5L11 21l8-11h-5.5L13 3z'),
  mark('storage', 'Object storage', 'data', ['storage', 'opslag', 'bucket', 'blob', 'object'],
    'M3 6h18l-2.2 14H5.2L3 6zM7 6a5 5 0 0 1 10 0'),
  mark('file-share', 'File share', 'data', ['bestanden', 'fileshare', 'map', 'netwerkschijf', 'folder'],
    'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM12 17v-6M9.5 13.5L12 11l2.5 2.5'),
  mark('queue', 'Message queue', 'data', ['queue', 'wachtrij', 'berichten', 'mq'],
    'M4 9h4v6H4zM10 9h4v6h-4zM16 9h4v6h-4z'),
  mark('event-stream', 'Event stream', 'data', ['stream', 'events', 'gebeurtenissen', 'streaming'],
    'M3 12h4l2-6 3 12 2.5-6H21'),
  mark('etl', 'ETL pipeline', 'data', ['etl', 'elt', 'pijplijn', 'transformatie', 'laden'],
    'M3 9h4v6H3zM17 9h4v6h-4zM8 12h3.5M10 10.5L11.5 12L10 13.5M13 12h3.5M15 10.5L16.5 12L15 13.5'),
  mark('report', 'Report', 'data', ['rapport', 'rapportage', 'overzicht', 'analyse'],
    'M6 3h8l4 4v14H6V3zM14 3v4h4M9 17v-3M12 17v-6M15 17v-4'),
];

// --- integration ---------------------------------------------------------------

const INTEGRATION: LogoEntry[] = [
  mark('api', 'API gateway', 'integration', ['api', 'gateway', 'rest', 'endpoint', 'koppelvlak'],
    'M9 5c-2 0-2 2-2 3.5S6 12 5 12c1 0 2 1 2 3.5S7 19 9 19M15 5c2 0 2 2 2 3.5S18 12 19 12c-1 0-2 1-2 3.5S17 19 15 19'),
  mark('integration-platform', 'Integration platform', 'integration',
    ['integratie', 'esb', 'ipaas', 'middleware', 'uitwisseling'],
    'M4 9h13M14 6l3 3l-3 3M20 15H7M10 12l-3 3l3 3'),
  mark('webhook', 'Webhook', 'integration', ['webhook', 'callback', 'push', 'melding'],
    'M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M13 12h8M18 9l3 3l-3 3'),
  mark('connector', 'Connector', 'integration', ['connector', 'koppeling', 'adapter', 'verbinding'],
    'M9.5 14.5l5-5M8.5 11.5L7 13a3.5 3.5 0 0 0 5 5l1.5-1.5M15.5 12.5L17 11a3.5 3.5 0 0 0-5-5l-1.5 1.5'),
  mark('message-broker', 'Message broker', 'integration', ['broker', 'bus', 'pubsub', 'berichten'],
    'M8 9h8v6H8zM3 12h5M16 12h5M12 4v5M12 15v5'),
  mark('batch-job', 'Batch job', 'integration', ['batch', 'job', 'taak', 'nachtrun', 'verwerking'],
    'M3 5h13v4H3zM3 15h13v4H3zM19.5 8v8M17 13.5l2.5 2.5l2.5-2.5'),
  mark('scheduler', 'Scheduler', 'integration', ['scheduler', 'planner', 'cron', 'tijd'],
    'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M12 7v5l3.5 2.5'),
];

// --- applications ---------------------------------------------------------------

const APPLICATIONS: LogoEntry[] = [
  mark('web-app', 'Web application', 'applications', ['web', 'browser', 'website', 'webapp'],
    'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 9h18M5.5 7h1M8 7h1'),
  mark('mobile-app', 'Mobile app', 'applications', ['mobiel', 'app', 'telefoon', 'smartphone'],
    'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM10.5 18h3'),
  mark('desktop-app', 'Desktop application', 'applications', ['desktop', 'werkplek', 'pc', 'client'],
    'M3 5h18v11H3zM9 20h6M12 16v4'),
  mark('portal', 'Portal', 'applications', ['portaal', 'loket', 'selfservice', 'ingang'],
    'M5 21V10a7 7 0 0 1 14 0v11M9 21v-8a3 3 0 0 1 6 0v8M3 21h18'),
  mark('dashboard', 'Dashboard', 'applications', ['dashboard', 'kpi', 'meter', 'overzicht'],
    'M4 18a8 8 0 1 1 16 0M4 18h16M12 18l4-5'),
  mark('workflow', 'Workflow', 'applications', ['workflow', 'proces', 'flow', 'bpm', 'stappen'],
    'M3 4h6v4H3zM15 16h6v4h-6zM6 8v5a2 2 0 0 0 2 2h7M13.5 16.5L15 18l-1.5 1.5'),
  mark('crm', 'CRM', 'applications', ['crm', 'klant', 'relatiebeheer', 'contact', 'customer'],
    'M8.5 10a3 3 0 1 0 0-6a3 3 0 1 0 0 6M3 19c.8-3 2.7-4.5 5.5-4.5S13.2 16 14 19M17 6h4M17 10h4M17 14h4'),
  mark('erp', 'ERP', 'applications', ['erp', 'bedrijfsvoering', 'backoffice', 'administratie'],
    'M3 8h18v12H3zM9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18M11 13v2.5h2V13'),
  mark('hr', 'HR system', 'applications', ['hr', 'personeel', 'medewerkers', 'hrm', 'salaris'],
    'M9 10a3 3 0 1 0 0-6a3 3 0 1 0 0 6M3 20c.8-3.4 3-5 6-5s5.2 1.6 6 5M17.5 11a2.5 2.5 0 1 0 0-5a2.5 2.5 0 1 0 0 5M16.5 15c2.6 0 4.4 1.7 4.9 5'),
  mark('finance', 'Finance system', 'applications', ['financieel', 'boekhouding', 'euro', 'grootboek', 'facturatie'],
    'M17 8.5a5.5 5.5 0 1 0 0 7M6 11h8M6 14h8'),
  mark('planning', 'Planning', 'applications', ['planning', 'agenda', 'kalender', 'rooster'],
    'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3M13 14h3M8 17h3'),
  mark('ticketing', 'Ticketing', 'applications', ['ticket', 'servicedesk', 'incident', 'melding', 'itsm'],
    'M3 9V5h18v4a2 2 0 0 0 0 6v4H3v-4a2 2 0 0 0 0-6zM12 7v2M12 11v2M12 15v2'),
  mark('document-management', 'Document management', 'applications',
    ['dms', 'documenten', 'archief', 'dossier'],
    'M9 3h6l4 4v12H9V3zM15 3v4h4M5 7v13a1 1 0 0 0 1 1h9M12 11h4M12 14h4'),
  mark('chat', 'Chat and collaboration', 'applications', ['chat', 'samenwerken', 'bericht', 'collaboration'],
    'M5 4h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-8l-4 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM7 8h10M7 11.5h6'),
];

// --- platform ---------------------------------------------------------------------

const PLATFORM: LogoEntry[] = [
  mark('cloud', 'Cloud', 'platform', ['cloud', 'iaas', 'hosting', 'publieke cloud'],
    'M6.5 19h11a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.6 10.1A4.5 4.5 0 0 0 6.5 19z'),
  mark('saas', 'SaaS', 'platform', ['saas', 'dienst', 'abonnement', 'software as a service'],
    'M6.5 15h11a3.5 3.5 0 0 0 .4-6.97A5.5 5.5 0 0 0 6.6 7.2A4 4 0 0 0 6.5 15zM12 15v6M9 18l3 3l3-3'),
  mark('mainframe', 'Mainframe', 'platform', ['mainframe', 'legacy', 'host', 'centraal systeem'],
    'M5 3h14v18H5zM5 9h14M5 15h14M8 6h3M8 12h3M8 18h3'),
  mark('virtual-machine', 'Virtual machine', 'platform', ['vm', 'virtueel', 'hypervisor', 'machine'],
    'M3 5h18v11H3zM7 8h10v5H7zM9 20h6M12 16v4'),
  mark('server', 'Server', 'platform', ['server', 'rack', 'on premise', 'hardware'],
    'M4 4h16v6H4zM4 14h16v6H4zM7 7h2M7 17h2M16 7h1M16 17h1'),
  mark('container', 'Container', 'platform', ['container', 'docker', 'kubernetes', 'image', 'pod'],
    'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5'),
  mark('serverless', 'Serverless', 'platform', ['serverless', 'function', 'lambda', 'faas', 'functie'],
    'M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7L12 3.5zM9 16.5l4.2-9M11.6 11l2.8 5.5'),
  mark('network', 'Network', 'platform', ['netwerk', 'lan', 'wan', 'infrastructuur', 'verbinding'],
    'M9 3h6v4H9zM3 17h5v4H3zM16 17h5v4h-5zM12 7v4M5.5 17v-2h13v2M12 11v4'),
  mark('iot-sensor', 'IoT sensor', 'platform', ['iot', 'sensor', 'meting', 'telemetrie', 'apparaat'],
    'M12 14a2 2 0 1 0 0-4a2 2 0 1 0 0 4M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M6 6a8 8 0 0 0 0 12M18 6a8 8 0 0 1 0 12'),
  mark('map', 'Map and geo', 'platform', ['kaart', 'geo', 'locatie', 'gis'],
    'M3 6l6-2l6 2l6-2v14l-6 2l-6-2l-6 2V6zM9 4v14M15 6v14'),
  mark('cdn', 'Content delivery', 'platform', ['cdn', 'edge', 'distributie', 'levering'],
    'M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M10.2 10.2L6.4 6.4M13.8 10.2l3.8-3.8M10.2 13.8l-3.8 3.8M13.8 13.8l3.8 3.8M5 3.2a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 1 0 0-3.6M19 3.2a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 1 0 0-3.6M5 17.2a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 1 0 0-3.6M19 17.2a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 1 0 0-3.6'),
];

// --- security & operations ---------------------------------------------------------

const SECURITY: LogoEntry[] = [
  mark('auth', 'Authentication', 'security', ['authenticatie', 'inloggen', 'sso', 'identiteit', 'idp'],
    'M12 3l7 3v5c0 4.5-3 8-7 10c-4-2-7-5.5-7-10V6l7-3zM12 9.2a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 1 0 0-3.6M12 12.8v2.7'),
  mark('authorisation', 'Authorisation', 'security', ['autorisatie', 'rechten', 'toegang', 'rollen', 'permissies'],
    'M16 3a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9M16 6.2a1.3 1.3 0 1 0 0 2.6a1.3 1.3 0 1 0 0-2.6M12.8 10.7L4 19.5M6 17.5l2 2M8.5 15l2 2'),
  mark('monitoring', 'Monitoring', 'security', ['monitoring', 'bewaking', 'metrics', 'observability'],
    'M3 5h18v11H3zM9 20h6M12 16v4M6 11h2.5l1.5-3l2 6l1.5-3H18'),
  mark('logging', 'Logging', 'security', ['logging', 'logs', 'logboek', 'audit trail'],
    'M4 6h3M10 6h10M4 12h3M10 12h10M4 18h3M10 18h10'),
  mark('alerting', 'Alerting', 'security', ['alert', 'alarm', 'melding', 'notificatie', 'oproep'],
    'M12 3a6 6 0 0 0-6 6c0 5-2 6-2 6h16s-2-1-2-6a6 6 0 0 0-6-6M10 18a2 2 0 0 0 4 0'),
  mark('backup', 'Backup', 'security', ['backup', 'herstel', 'restore', 'veiligstellen'],
    'M12 3v9M8.5 8.5L12 12l3.5-3.5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4'),
  mark('firewall', 'Firewall', 'security', ['firewall', 'zonering', 'netwerkbeveiliging', 'filter'],
    'M3 6h18v12H3zM3 10h18M3 14h18M9 6v4M15 6v4M6 10v4M12 10v4M18 10v4M9 14v4M15 14v4'),
  mark('secrets', 'Secrets management', 'security', ['secrets', 'vault', 'sleutels', 'wachtwoorden', 'geheimen'],
    'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3M12 14v3'),
  mark('certificate', 'Certificate', 'security', ['certificaat', 'tls', 'ssl', 'pki'],
    'M4 3h16v12H4zM7 7h10M7 10.5h6M12 15.5a3 3 0 1 0 0 6a3 3 0 1 0 0-6M10 21l-.8 2.5l2.8-1.5l2.8 1.5L14 21'),
];

/** Ordered: data, integration, applications, platform, security & operations. */
export const GENERIC_MARKS: LogoEntry[] = [
  ...DATA,
  ...INTEGRATION,
  ...APPLICATIONS,
  ...PLATFORM,
  ...SECURITY,
];

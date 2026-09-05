import {
  siAnsible,
  siApacheairflow,
  siApachekafka,
  siAtlassian,
  siAuth0,
  siBitbucket,
  siCloudflare,
  siConfluence,
  siDatabricks,
  siDatadog,
  siDocker,
  siDynatrace,
  siElastic,
  siGithub,
  siGitlab,
  siGooglebigquery,
  siGooglecloud,
  siGrafana,
  siJenkins,
  siJira,
  siKeycloak,
  siKong,
  siKubernetes,
  siMongodb,
  siMysql,
  siNederlandsespoorwegen,
  siNewrelic,
  siNginx,
  siOkta,
  siPagerduty,
  siPostgresql,
  siPrometheus,
  siQlik,
  siRabbitmq,
  siRedhat,
  siRedis,
  siSap,
  siSnowflake,
  siSplunk,
  siTerraform,
  siVmware,
  siZendesk,
} from 'simple-icons';
import type { SimpleIcon } from 'simple-icons';
import type { LogoEntry } from '../logoRegistry';

/**
 * VENDOR MARKS — real brands, from the CC0 `simple-icons` package.
 *
 * The roadmap decision (5) that allows them: this is an internal tool, the icons
 * are CC0, and a landscape drawn without SAP's or Kubernetes' own mark on the
 * boxes that ARE SAP and Kubernetes is harder to read than one with them. They
 * are imported PER ICON from a pinned exact version, never as a whole-package
 * `import * as`, so the bundle carries only these paths.
 *
 * `simple-icons` ships each icon as a single 24×24 path meant to be FILLED, so
 * these entries carry `render: 'fill'` — see `PathMark`. They still inherit
 * `currentColor`, which is the point: a brand mark tinted to the node's ink sits
 * on a diagram without turning it into a sponsor wall, and it survives both MUI
 * themes and the per-element accent override. The full-colour path is the
 * UPLOADED library (`UploadedLogo`), where a brand's own colour is the reason to
 * upload it.
 *
 * BRANDS THAT ARE NOT HERE. `simple-icons` has removed a long list of enterprise
 * marks on trademark-holder request, and several of the roadmap's wish-list names
 * are among them — Salesforce, ServiceNow, Microsoft (and Azure, Teams,
 * SharePoint, Power BI), AWS, Oracle, Slack, Tableau, MuleSoft, Workday, Exact,
 * AFAS, TOPdesk, Mendix, OutSystems. There is no substitute mark for a brand: a
 * lookalike would be worse than none. Those elements use a generic category mark
 * (`marks/generic.ts`) or an uploaded logo, which is exactly the path the upload
 * library exists for. Do NOT hand-draw them here.
 *
 * The `vendor-` key prefix keeps this set apart from the hand-authored keys, and
 * like those, these keys are PERSISTED (`iconKey`, interchange `iconType`) and
 * therefore append-only. The label comes from the package's own `title`, so a
 * brand that renames itself renames itself here on the next version bump.
 */

const vendor = (key: string, icon: SimpleIcon, keywords: string[]): LogoEntry => ({
  key,
  label: icon.title,
  category: 'vendors',
  keywords,
  path: icon.path,
  render: 'fill',
});

export const VENDOR_MARKS: LogoEntry[] = [
  // Business platforms
  vendor('vendor-sap', siSap, ['sap', 'erp', 'hana', 's4hana', 'financieel']),
  vendor('vendor-zendesk', siZendesk, ['zendesk', 'servicedesk', 'tickets', 'klantcontact']),
  vendor('vendor-ns', siNederlandsespoorwegen, ['ns', 'nederlandse spoorwegen', 'spoor', 'vervoerder']),

  // Collaboration and source
  vendor('vendor-atlassian', siAtlassian, ['atlassian', 'jira', 'confluence', 'samenwerken']),
  vendor('vendor-jira', siJira, ['jira', 'tickets', 'issues', 'backlog', 'agile']),
  vendor('vendor-confluence', siConfluence, ['confluence', 'wiki', 'documentatie', 'kennisbank']),
  vendor('vendor-github', siGithub, ['github', 'git', 'repository', 'broncode']),
  vendor('vendor-gitlab', siGitlab, ['gitlab', 'git', 'repository', 'ci', 'devops']),
  vendor('vendor-bitbucket', siBitbucket, ['bitbucket', 'git', 'repository', 'broncode']),

  // Data and analytics
  vendor('vendor-snowflake', siSnowflake, ['snowflake', 'datawarehouse', 'dwh', 'analytics']),
  vendor('vendor-databricks', siDatabricks, ['databricks', 'lakehouse', 'spark', 'analytics']),
  vendor('vendor-bigquery', siGooglebigquery, ['bigquery', 'google', 'datawarehouse', 'analytics']),
  vendor('vendor-qlik', siQlik, ['qlik', 'bi', 'rapportage', 'dashboard']),
  vendor('vendor-postgresql', siPostgresql, ['postgres', 'postgresql', 'database', 'sql']),
  vendor('vendor-mysql', siMysql, ['mysql', 'database', 'sql']),
  vendor('vendor-mongodb', siMongodb, ['mongodb', 'database', 'nosql', 'documenten']),
  vendor('vendor-redis', siRedis, ['redis', 'cache', 'key value', 'tussenopslag']),

  // Integration and messaging
  vendor('vendor-kafka', siApachekafka, ['kafka', 'events', 'streaming', 'broker']),
  vendor('vendor-rabbitmq', siRabbitmq, ['rabbitmq', 'queue', 'wachtrij', 'amqp', 'broker']),
  vendor('vendor-airflow', siApacheairflow, ['airflow', 'orkestratie', 'etl', 'dag', 'planner']),
  vendor('vendor-kong', siKong, ['kong', 'api gateway', 'api', 'proxy']),
  vendor('vendor-nginx', siNginx, ['nginx', 'webserver', 'proxy', 'loadbalancer']),

  // Identity
  vendor('vendor-okta', siOkta, ['okta', 'sso', 'identiteit', 'authenticatie', 'iam']),
  vendor('vendor-auth0', siAuth0, ['auth0', 'sso', 'identiteit', 'authenticatie', 'oidc']),
  vendor('vendor-keycloak', siKeycloak, ['keycloak', 'sso', 'identiteit', 'oidc', 'saml']),

  // Observability and operations
  vendor('vendor-splunk', siSplunk, ['splunk', 'logging', 'siem', 'monitoring']),
  vendor('vendor-dynatrace', siDynatrace, ['dynatrace', 'apm', 'monitoring', 'observability']),
  vendor('vendor-datadog', siDatadog, ['datadog', 'monitoring', 'observability', 'apm']),
  vendor('vendor-new-relic', siNewrelic, ['new relic', 'apm', 'monitoring', 'observability']),
  vendor('vendor-grafana', siGrafana, ['grafana', 'dashboard', 'metrics', 'monitoring']),
  vendor('vendor-prometheus', siPrometheus, ['prometheus', 'metrics', 'monitoring', 'alerting']),
  vendor('vendor-elastic', siElastic, ['elastic', 'elk', 'zoeken', 'logging', 'observability']),
  vendor('vendor-pagerduty', siPagerduty, ['pagerduty', 'alerting', 'oproep', 'piket', 'incident']),

  // Platform and delivery
  vendor('vendor-google-cloud', siGooglecloud, ['gcp', 'google', 'cloud', 'hyperscaler']),
  vendor('vendor-cloudflare', siCloudflare, ['cloudflare', 'cdn', 'dns', 'waf', 'edge']),
  vendor('vendor-kubernetes', siKubernetes, ['kubernetes', 'k8s', 'containers', 'orkestratie']),
  vendor('vendor-docker', siDocker, ['docker', 'container', 'image', 'build']),
  vendor('vendor-red-hat', siRedhat, ['red hat', 'rhel', 'linux', 'openshift']),
  vendor('vendor-vmware', siVmware, ['vmware', 'virtualisatie', 'vsphere', 'vm']),
  vendor('vendor-terraform', siTerraform, ['terraform', 'iac', 'infrastructuur', 'provisioning']),
  vendor('vendor-ansible', siAnsible, ['ansible', 'configuratiebeheer', 'automatisering', 'iac']),
  vendor('vendor-jenkins', siJenkins, ['jenkins', 'ci', 'build', 'pipeline']),
];

import { IntelligenceItem } from './types.js';

export const INITIAL_INTELLIGENCE_ITEMS: IntelligenceItem[] = [
  {
    id: 'intel-inf-001',
    entity: 'Infosys',
    isClient: true,
    platform: 'print_epaper',
    metadata: {
      newspaperOrSource: 'The Economic Times',
      author: 'Surabhi Agarwal & Deepsekhar Choudhury',
      pageNumber: 'Page 1 (Front Page Lead)',
      headline: 'FinTech Regulatory Oversight: RBI Issues Notice on Cloud Compliance',
      shortDescription: 'National banking regulator requests expedited compliance audits on enterprise banking software suites deployed across Tier-1 banks.',
      fullText: 'The Reserve Bank of India has initiated a comprehensive digital banking security audit across primary tech service vendors. Banking leaders have been requested to submit cloud architectural sovereignty disclosures within 48 hours.',
      url: 'https://economictimes.indiatimes.com/tech/ites/rbi-audit-cloud-banking',
      verifiedSource: true,
      reachCount: '1.2M daily readers'
    },
    sentiment: 'critical_crisis',
    sentimentScore: -0.84,
    riskScore: 9.4,
    riskLevel: 'Critical',
    summary: {
      whatHappened: 'The Reserve Bank of India issued an unannounced front-page digital compliance audit notice covering Infosys Finacle client installations.',
      whyItMatters: 'Potential regulatory scrutiny could trigger emergency audit inquiries from top European and domestic banking clients.',
      riskJustification: 'Front-page ePaper lead circulation threatens enterprise reputation before official market open at 09:15 AM.',
      competitorImpact: 'TCS BaNCS and Accenture Banking Solutions will attempt aggressive client outreach if silence persists.',
      recommendedAction: 'Immediate CMO crisis statement deployment; activate Chief Information Security Officer for client security briefing.'
    },
    sla: {
      publishedAt: new Date(Date.now() - 72000).toISOString(),
      ingestedAt: new Date(Date.now() - 58000).toISOString(),
      triagedAt: new Date(Date.now() - 41000).toISOString(),
      dispatchedAt: new Date(Date.now() - 36000).toISOString(),
      ingestDurationMs: 14000,
      triageDurationMs: 17000,
      dispatchDurationMs: 5000,
      totalDurationMs: 36000,
      slaBreached: false
    },
    dispatch: {
      dashboard: true,
      whatsapp: { dispatched: true, recipient: '+91-98840-CRISIS', timestamp: '2:14:36 AM' },
      slack: { dispatched: true, channel: '#crisis-war-room-exec', timestamp: '2:14:36 AM' },
      email: { dispatched: true, recipients: ['cmo@infosys.com', 'legal-escalations@infosys.com'], timestamp: '2:14:36 AM' },
      voiceCall: {
        dispatched: true,
        targetRole: 'Chief Crisis Officer & CMO',
        phone: '+91-98840-83333',
        callStatus: 'ringing',
        timestamp: '2:14:36 AM'
      }
    },
    status: 'active'
  },
  {
    id: 'intel-tcs-002',
    entity: 'TCS',
    isClient: false,
    platform: 'twitter',
    metadata: {
      newspaperOrSource: 'Twitter/X (Enterprise Monitor)',
      author: '@FinTechDisrupt_Global (Verified Tech Watch)',
      headline: 'Major Outage Hits European Core Banking Cloud Serviced by TCS',
      shortDescription: 'Multiple Nordic banking apps down for over 4 hours. Escalating backlash under #TCSDown with 42K tweets in the last hour.',
      fullText: 'Customers in Sweden and Norway report complete transactional downtime across core digital portals operated under TCS infrastructure agreements.',
      url: 'https://x.com/FinTechDisrupt_Global/status/18363829101',
      verifiedSource: true,
      reachCount: '42.8K Tweets / Hr'
    },
    sentiment: 'negative',
    sentimentScore: -0.76,
    riskScore: 6.8,
    riskLevel: 'High',
    summary: {
      whatHappened: 'TCS-managed Nordic banking infrastructure suffered a catastrophic four-hour outage during peak morning hours.',
      whyItMatters: 'Severe SLA penalties and public customer backlash represent a prime vulnerability in TCS Financial Solutions.',
      riskJustification: 'Viral social backlash trending on Twitter/X across European banking corridors.',
      competitorImpact: 'TCS engineering teams are locked in triage; RFPs for upcoming Nordic renewals now vulnerable to Infosys proposals.',
      recommendedAction: 'Equip Infosys European Financial Services sales team with Cloud Resilience benchmark collateral within 4 hours.'
    },
    sla: {
      publishedAt: new Date(Date.now() - 145000).toISOString(),
      ingestedAt: new Date(Date.now() - 128000).toISOString(),
      triagedAt: new Date(Date.now() - 114000).toISOString(),
      dispatchedAt: new Date(Date.now() - 110000).toISOString(),
      ingestDurationMs: 17000,
      triageDurationMs: 14000,
      dispatchDurationMs: 4000,
      totalDurationMs: 35000,
      slaBreached: false
    },
    dispatch: {
      dashboard: true,
      whatsapp: { dispatched: true, recipient: '+91-98840-STRATEGY', timestamp: '2:11:40 AM' },
      slack: { dispatched: true, channel: '#market-intelligence-intel', timestamp: '2:11:40 AM' },
      email: { dispatched: true, recipients: ['vp-sales-europe@infosys.com'], timestamp: '2:11:40 AM' },
      voiceCall: {
        dispatched: false,
        targetRole: 'Voice only for Tier 4 Critical',
        phone: '',
        callStatus: 'idle'
      }
    },
    status: 'investigating'
  },
  {
    id: 'intel-wip-003',
    entity: 'Wipro',
    isClient: false,
    platform: 'facebook',
    metadata: {
      newspaperOrSource: 'Facebook / Live Business Journal',
      author: 'Industry Watchdesk International',
      headline: 'Wipro Restructures Consulting Leadership Amid Strategic Realignment',
      shortDescription: 'Internal corporate memo leaked to social forums details management reorganization across Capco and digital transformation units.',
      fullText: 'A high-level restructuring at Wipro will see three senior executive vice presidents transition responsibilities following quarterly advisory margin compression.',
      url: 'https://facebook.com/watchdesk/posts/993182819',
      verifiedSource: true,
      reachCount: '85K Shares & Engagements'
    },
    sentiment: 'neutral',
    sentimentScore: -0.18,
    riskScore: 4.2,
    riskLevel: 'Medium',
    summary: {
      whatHappened: 'Leaked internal memo confirms senior consulting leadership transitions within Wipro digital transformation practice.',
      whyItMatters: 'Indicates potential short-term delivery friction in North American enterprise consulting accounts.',
      riskJustification: 'Social buzz on Facebook corporate forums; moderate risk to market equilibrium.',
      competitorImpact: 'Client uncertainty opens a window to pitch Infosys Cobalt and consulting continuity.',
      recommendedAction: 'Monitor high-value enterprise accounts in Midwest US currently co-serviced by Wipro.'
    },
    sla: {
      publishedAt: new Date(Date.now() - 210000).toISOString(),
      ingestedAt: new Date(Date.now() - 192000).toISOString(),
      triagedAt: new Date(Date.now() - 176000).toISOString(),
      dispatchedAt: new Date(Date.now() - 172000).toISOString(),
      ingestDurationMs: 18000,
      triageDurationMs: 16000,
      dispatchDurationMs: 4000,
      totalDurationMs: 38000,
      slaBreached: false
    },
    dispatch: {
      dashboard: true,
      whatsapp: { dispatched: false },
      slack: { dispatched: true, channel: '#competitor-radar-feed', timestamp: '2:08:12 AM' },
      email: { dispatched: false },
      voiceCall: {
        dispatched: false,
        targetRole: 'Voice only for Tier 4 Critical',
        phone: '',
        callStatus: 'idle'
      }
    },
    status: 'acknowledged'
  },
  {
    id: 'intel-acc-004',
    entity: 'Accenture',
    isClient: false,
    platform: 'instagram',
    metadata: {
      newspaperOrSource: 'Instagram / TechTrends Global',
      author: '@TechTrendsOfficial (1.8M Followers)',
      headline: 'Accenture Unveils $3 Billion Enterprise Generative AI Expansion Campaign',
      shortDescription: 'High-production visual campaign showcases automated code synthesis and AI-agent factories across Fortune 100 enterprise clients.',
      fullText: 'Accenture launched a worldwide digital campaign illustrating massive cost reductions for enterprise clients adopting their proprietary GenAI foundation models.',
      url: 'https://instagram.com/p/C9f832jkl/',
      verifiedSource: true,
      reachCount: '410K Video Views'
    },
    sentiment: 'positive',
    sentimentScore: 0.82,
    riskScore: 5.5,
    riskLevel: 'Medium',
    summary: {
      whatHappened: 'Accenture launched a viral global GenAI campaign across visual and business social platforms.',
      whyItMatters: 'Strong branding offensive targeting CIO mindshare for upcoming Q4 enterprise budgeting.',
      riskJustification: 'Aggressive marketing presence; moderate strategic pressure on Infosys Topaz.',
      competitorImpact: 'Sets high market benchmark for GenAI customer proof points.',
      recommendedAction: 'Accelerate Infosys Topaz generative enterprise case study publications across LinkedIn and X.'
    },
    sla: {
      publishedAt: new Date(Date.now() - 290000).toISOString(),
      ingestedAt: new Date(Date.now() - 271000).toISOString(),
      triagedAt: new Date(Date.now() - 253000).toISOString(),
      dispatchedAt: new Date(Date.now() - 250000).toISOString(),
      ingestDurationMs: 19000,
      triageDurationMs: 18000,
      dispatchDurationMs: 3000,
      totalDurationMs: 40000,
      slaBreached: false
    },
    dispatch: {
      dashboard: true,
      whatsapp: { dispatched: false },
      slack: { dispatched: true, channel: '#brand-positioning', timestamp: '2:05:50 AM' },
      email: { dispatched: false },
      voiceCall: {
        dispatched: false,
        targetRole: 'Voice only for Tier 4 Critical',
        phone: '',
        callStatus: 'idle'
      }
    },
    status: 'resolved'
  }
];

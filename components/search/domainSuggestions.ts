export interface DomainSuggestions {
  motsCles: string[]
  exclusions: string[]
  qualifications: string[]
}

export const DOMAIN_SUGGESTIONS: Record<string, DomainSuggestions> = {
  data_ia: {
    motsCles: ['data scientist', 'data analyst', 'machine learning', 'data engineer', 'MLOps', 'intelligence artificielle'],
    exclusions: ['stage', 'junior', "5 ans d'expérience", 'senior', 'thèse', 'doctorat'],
    qualifications: ['AWS', 'Azure', 'GCP', 'TensorFlow', 'PyTorch', 'SQL', 'Python', 'Bac+5'],
  },
  dev_logiciel: {
    motsCles: ['développeur', 'ingénieur logiciel', 'full stack', 'backend', 'frontend', 'software engineer'],
    exclusions: ['stage', 'junior', 'lead', "5 ans d'expérience", 'architecte'],
    qualifications: ['JavaScript', 'TypeScript', 'Java', 'Python', 'React', 'Node.js', 'Bac+5'],
  },
  devops_cloud: {
    motsCles: ['devops', 'sre', 'cloud engineer', 'infrastructure', 'plateforme', 'ci/cd'],
    exclusions: ['stage', 'junior', 'lead', "5 ans d'expérience"],
    qualifications: ['AWS', 'Azure', 'GCP', 'Kubernetes', 'Docker', 'Terraform', 'Bac+5'],
  },
  cybersecurite: {
    motsCles: ['sécurité informatique', 'analyste soc', 'pentester', 'cybersécurité', 'RSSI'],
    exclusions: ['stage', 'junior', 'lead', "5 ans d'expérience"],
    qualifications: ['CEH', 'OSCP', 'ISO 27001', 'CISSP', 'Bac+5'],
  },
  product_design: {
    motsCles: ['product manager', 'product owner', 'UX designer', 'UI designer', 'chef de produit'],
    exclusions: ['stage', 'junior', 'lead', "5 ans d'expérience"],
    qualifications: ['Figma', 'Agile', 'Scrum', 'Bac+5'],
  },
  reseaux_infra: {
    motsCles: ['administrateur réseau', 'ingénieur infrastructure', 'réseaux et télécoms', 'systèmes et réseaux'],
    exclusions: ['stage', 'junior', 'lead', "5 ans d'expérience"],
    qualifications: ['CCNA', 'CCNP', 'Linux', 'Windows Server', 'Bac+2'],
  },
  support_it: {
    motsCles: ['support informatique', 'technicien helpdesk', 'assistance utilisateurs', 'technicien support'],
    exclusions: ['lead', "5 ans d'expérience", 'senior'],
    qualifications: ['ITIL', 'Bac+2'],
  },
}

export const DOMAIN_OPTIONS: { value: string; label: string }[] = [
  { value: 'data_ia', label: 'Data / IA' },
  { value: 'dev_logiciel', label: 'Développement logiciel' },
  { value: 'devops_cloud', label: 'DevOps / Cloud' },
  { value: 'cybersecurite', label: 'Cybersécurité' },
  { value: 'product_design', label: 'Product / Design' },
  { value: 'reseaux_infra', label: 'Réseaux / Infra' },
  { value: 'support_it', label: 'Support IT' },
  { value: 'autre', label: 'Autre' },
]

export const DOMAIN_LABELS: Record<string, string> = Object.fromEntries(
  DOMAIN_OPTIONS.map(o => [o.value, o.label])
)

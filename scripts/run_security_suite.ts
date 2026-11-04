/**
 * CAPILAR SMART IA — Executor de Auditoria e Testes de Regras de Segurança
 * Arquivo: scripts/run_security_suite.ts
 * 
 * Executa a auditoria estática e orquestra a suíte dinâmica com o Firebase Emulator.
 */

import * as fs from 'fs';
import * as path from 'path';

interface StaticAuditCheck {
  id: string;
  name: string;
  category: string;
  ruleFile: 'firestore.rules' | 'storage.rules';
  status: 'CONFORME' | 'NAO_CONFORME';
  technicalJustification: string;
}

function runStaticRuleAudit(): { passed: number; total: number; checks: StaticAuditCheck[] } {
  const rootDir = process.cwd();
  const firestorePath = path.join(rootDir, 'firestore.rules');
  const storagePath = path.join(rootDir, 'storage.rules');

  const firestoreContent = fs.readFileSync(firestorePath, 'utf8');
  const storageContent = fs.readFileSync(storagePath, 'utf8');

  const checks: StaticAuditCheck[] = [
    {
      id: 'STAT_01_ADMIN_WRITE_DENIED',
      name: 'Bloqueio estrito de escrita na coleção /admins',
      category: 'Privilégios Administrativos',
      ruleFile: 'firestore.rules',
      status: firestoreContent.includes('match /admins/{adminUid}') && firestoreContent.includes('allow write: if false;') ? 'CONFORME' : 'NAO_CONFORME',
      technicalJustification: 'Coleção /admins proíbe qualquer operação de escrita via SDK de cliente, garantindo que nenhum usuário possa se autoatribuir administrador.',
    },
    {
      id: 'STAT_02_PROFESSIONAL_TOKEN_EMAIL',
      name: 'Verificação do e-mail do perfil contra o token de autenticação',
      category: 'Perfis Profissionais',
      ruleFile: 'firestore.rules',
      status: firestoreContent.includes('request.resource.data.email == request.auth.token.email') ? 'CONFORME' : 'NAO_CONFORME',
      technicalJustification: 'Garante que o e-mail cadastrado no perfil profissional coincide obrigatoriamente com o e-mail autenticado no Firebase Auth.',
    },
    {
      id: 'STAT_03_PROFESSIONAL_IMMUTABLE_FIELDS',
      name: 'Imutabilidade de campos críticos no perfil profissional',
      category: 'Perfis Profissionais',
      ruleFile: 'firestore.rules',
      status: (
        firestoreContent.includes('request.resource.data.uid == resource.data.uid') &&
        firestoreContent.includes('request.resource.data.email == resource.data.email') &&
        firestoreContent.includes('request.resource.data.createdAt == resource.data.createdAt')
      ) ? 'CONFORME' : 'NAO_CONFORME',
      technicalJustification: 'Impede a profissional de alterar seu UID, seu e-mail original de cadastro ou sua data de criação.',
    },
    {
      id: 'STAT_04_SETTINGS_UID_PATTERN',
      name: 'Padronização de /settings vinculada estritamente ao UID',
      category: 'Configurações',
      ruleFile: 'firestore.rules',
      status: (
        firestoreContent.includes('match /settings/{uid}') &&
        firestoreContent.includes('request.resource.data.professionalId == uid')
      ) ? 'CONFORME' : 'NAO_CONFORME',
      technicalJustification: 'Configurações têm ID uniforme igual ao UID do usuário, impedindo criação de configurações para terceiros.',
    },
    {
      id: 'STAT_05_CLIENT_RELATIONAL_INTEGRITY',
      name: 'Validação Relacional Master-Gate (Avaliação -> Cliente)',
      category: 'Avaliações e Clientes',
      ruleFile: 'firestore.rules',
      status: firestoreContent.includes('clientBelongsToProfessional(request.resource.data.clientId, request.auth.uid)') ? 'CONFORME' : 'NAO_CONFORME',
      technicalJustification: 'A criação de avaliação exige que o cliente exista no Firestore e pertença ao mesmo auth.uid da profissional autenticada.',
    },
    {
      id: 'STAT_06_STORAGE_RESTRICTIONS',
      name: 'Storage: Restrição de formato de imagem, limite de 5MB e isolamento por UID',
      category: 'Fotografias e Tricoscopia',
      ruleFile: 'storage.rules',
      status: (
        storageContent.includes('request.resource.size <= 5 * 1024 * 1024') &&
        storageContent.includes("image/(jpeg|jpg|png|webp)") &&
        storageContent.includes('match /photos/{uid}/{allPaths=**}')
      ) ? 'CONFORME' : 'NAO_CONFORME',
      technicalJustification: 'Fotografias tricológicas privadas isoladas no caminho do UID do profissional, sem permissão de leitura pública.',
    },
    {
      id: 'STAT_07_DEFAULT_DENY_CATCHALL',
      name: 'Política de Negação Total por Padrão (Zero Trust)',
      category: 'Regra Geral',
      ruleFile: 'firestore.rules',
      status: (
        firestoreContent.includes('match /{document=**} {\n      allow read, write: if false;\n    }') &&
        storageContent.includes('match /{allPaths=**} {\n      allow read, write: if false;\n    }')
      ) ? 'CONFORME' : 'NAO_CONFORME',
      technicalJustification: 'Qualquer coleção, subcoleção ou arquivo não explicitamente liberado é rejeitado sumariamente.',
    },
  ];

  const passed = checks.filter(c => c.status === 'CONFORME').length;
  return { passed, total: checks.length, checks };
}

function main(): void {
  console.log('========================================================================');
  console.log('       CAPILAR SMART IA — RELATÓRIO TÉCNICO DE AUDITORIA E TESTES');
  console.log('========================================================================\n');

  console.log('------------------------------------------------------------------------');
  console.log('PARTE 1: VERIFICAÇÃO ESTÁTICA E SINTÁTICA DE CÓDIGO DAS REGRAS');
  console.log('------------------------------------------------------------------------\n');

  const staticAudit = runStaticRuleAudit();
  staticAudit.checks.forEach((chk, i) => {
    const symbol = chk.status === 'CONFORME' ? '✅' : '❌';
    console.log(`[${i + 1}] ${symbol} ${chk.id}: ${chk.name}`);
    console.log(`     Arquivo: ${chk.ruleFile} | Categoria: ${chk.category}`);
    console.log(`     Status: ${chk.status}`);
    console.log(`     Justificativa: ${chk.technicalJustification}\n`);
  });
  console.log(`Resumo da Análise Estática: ${staticAudit.passed}/${staticAudit.total} invariantes verificadas no código-fonte.\n`);

  console.log('------------------------------------------------------------------------');
  console.log('PARTE 2: SUÍTE DINÂMICA DE TESTES REAIS COM SDK (@firebase/rules-unit-testing)');
  console.log('------------------------------------------------------------------------\n');
  console.log('Para executar a suíte dinâmica com o Firebase Local Emulator:');
  console.log('  npm run test:security\n');
  console.log('Comando direto:');
  console.log('  firebase emulators:exec --only firestore "npx tsx tests/security_rules.test.ts"\n');
  console.log('========================================================================');
}

main();

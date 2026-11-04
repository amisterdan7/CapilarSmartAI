/**
 * CAPILAR SMART IA — Suíte Oficial Unificada de Testes Dinâmicos (Firestore & Storage)
 * Arquivo: tests/security_rules.test.ts
 * 
 * Executa operações reais contra os emuladores do Cloud Firestore e Firebase Storage
 * utilizando a biblioteca oficial '@firebase/rules-unit-testing'.
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ID = 'capilar-smart-ia-test';

export interface DynamicTestResult {
  code: string;
  name: string;
  emulator: 'FIRESTORE' | 'STORAGE';
  category: 'AUTH' | 'ADMIN' | 'ISOLAMENTO' | 'INTEGRIDADE' | 'STORAGE_MIME' | 'STORAGE_SIZE' | 'QUERY';
  expectedOutcome: 'ASSERT_SUCCEEDS' | 'ASSERT_FAILS';
  executionStatus: 'APROVADO' | 'REJEITADO' | 'BLOQUEADO_AMBIENTE';
  details: string;
}

export async function runFullSecuritySuite(): Promise<{
  results: DynamicTestResult[];
  passed: number;
  failed: number;
  firestoreCount: number;
  storageCount: number;
  blocked: boolean;
}> {
  const rootDir = process.cwd();
  const firestoreRules = fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8');
  const storageRules = fs.readFileSync(path.join(rootDir, 'storage.rules'), 'utf8');

  let testEnv: RulesTestEnvironment;

  const firestoreHostEnv = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [fHost, fPortStr] = firestoreHostEnv.split(':');
  const firestorePort = parseInt(fPortStr || '8080', 10);

  const storageHostEnv = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
  const [sHost, sPortStr] = storageHostEnv.split(':');
  const storagePort = parseInt(sPortStr || '9199', 10);

  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: firestoreRules,
        host: fHost,
        port: firestorePort,
      },
      storage: {
        rules: storageRules,
        host: sHost,
        port: storagePort,
      },
    });
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || String(err);
    return {
      results: [
        {
          code: 'EMULATOR_CONNECT_FAIL',
          name: 'Conexão com Firebase Emulator Suite',
          emulator: 'FIRESTORE',
          category: 'AUTH',
          expectedOutcome: 'ASSERT_SUCCEEDS',
          executionStatus: 'BLOQUEADO_AMBIENTE',
          details: `Emuladores indisponíveis (${errorMsg}).`,
        },
      ],
      passed: 0,
      failed: 0,
      firestoreCount: 0,
      storageCount: 0,
      blocked: true,
    };
  }

  const results: DynamicTestResult[] = [];

  const uidProfA = 'prof-ana-111';
  const uidProfB = 'prof-beatriz-222';
  const adminUid = 'admin-master-999';

  const emailProfA = 'ana@terapiacapilar.com';
  const emailProfB = 'beatriz@terapiacapilar.com';
  const emailAdmin = 'admin@capilarsmart.com';

  const contextA = testEnv.authenticatedContext(uidProfA, { email: emailProfA });
  const contextB = testEnv.authenticatedContext(uidProfB, { email: emailProfB });
  const contextAdmin = testEnv.authenticatedContext(adminUid, { email: emailAdmin });
  const unauthContext = testEnv.unauthenticatedContext();

  const dbA = contextA.firestore();
  const dbB = contextB.firestore();
  const dbAdmin = contextAdmin.firestore();
  const dbUnauth = unauthContext.firestore();

  const storageA = contextA.storage();
  const storageB = contextB.storage();
  const storageUnauth = unauthContext.storage();

  async function testAssertion(
    code: string,
    name: string,
    emulator: DynamicTestResult['emulator'],
    category: DynamicTestResult['category'],
    type: 'FAIL' | 'SUCCEED',
    fn: () => PromiseLike<unknown>,
    successMessage: string
  ) {
    try {
      if (type === 'FAIL') {
        await assertFails(Promise.resolve(fn()));
      } else {
        await assertSucceeds(Promise.resolve(fn()));
      }
      results.push({
        code,
        name,
        emulator,
        category,
        expectedOutcome: type === 'FAIL' ? 'ASSERT_FAILS' : 'ASSERT_SUCCEEDS',
        executionStatus: 'APROVADO',
        details: successMessage,
      });
    } catch (e) {
      results.push({
        code,
        name,
        emulator,
        category,
        expectedOutcome: type === 'FAIL' ? 'ASSERT_FAILS' : 'ASSERT_SUCCEEDS',
        executionStatus: 'REJEITADO',
        details: (e as Error).message,
      });
    }
  }

  // =========================================================================
  // SEÇÃO 1: CLOUD FIRESTORE EMULATOR TESTS
  // =========================================================================

  // [FS 1-3] Usuários Anônimos
  await testAssertion(
    'FS_01_UNAUTH_READ_PROFILE',
    'Bloqueio de leitura de perfil por usuário anônimo',
    'FIRESTORE',
    'AUTH',
    'FAIL',
    () => dbUnauth.collection('professionals').doc(uidProfA).get(),
    'Usuário anônimo foi barrado ao tentar ler /professionals/{uid}.'
  );

  await testAssertion(
    'FS_02_UNAUTH_CREATE_CLIENT',
    'Bloqueio de criação de cliente por usuário anônimo',
    'FIRESTORE',
    'AUTH',
    'FAIL',
    () => dbUnauth.collection('clients').doc('client-anon').set({
      id: 'client-anon',
      professionalId: uidProfA,
      name: 'Cliente Anônimo',
      createdAt: new Date().toISOString(),
    }),
    'Usuário anônimo foi impedido de gravar cliente.'
  );

  await testAssertion(
    'FS_03_UNAUTH_READ_ADMINS',
    'Bloqueio de leitura de /admins por usuário anônimo',
    'FIRESTORE',
    'ADMIN',
    'FAIL',
    () => dbUnauth.collection('admins').doc(adminUid).get(),
    'Usuário anônimo não conseguiu acessar coleção /admins.'
  );

  // [FS 4-9] Perfis Profissionais
  await testAssertion(
    'FS_04_PROF_LEGITIMATE_CREATE',
    'Criação legítima de perfil profissional com email verificado do token',
    'FIRESTORE',
    'AUTH',
    'SUCCEED',
    () => dbA.collection('professionals').doc(uidProfA).set({
      uid: uidProfA,
      email: emailProfA,
      name: 'Dra. Ana Tricologista',
      clinicName: 'Clínica Capilar Smart',
      phone: '11988887777',
      role: 'professional',
      createdAt: new Date().toISOString(),
    }),
    'Perfil cadastrado com sucesso com dados legítimos e validação de token.'
  );

  await testAssertion(
    'FS_05_PROF_MISMATCHED_EMAIL',
    'Bloqueio de criação com email divergente do token autenticado',
    'FIRESTORE',
    'AUTH',
    'FAIL',
    () => dbA.collection('professionals').doc('prof-spoof-email').set({
      uid: uidProfA,
      email: 'hacker@fraude.com',
      name: 'Dra. Ana',
      createdAt: new Date().toISOString(),
    }),
    'Tentativa de cadastrar e-mail não correspondente ao token de autenticação foi rejeitada.'
  );

  await testAssertion(
    'FS_06_PROF_ROLE_ADMIN_ESCALATION',
    'Bloqueio de autoatribuição de role: admin no perfil',
    'FIRESTORE',
    'ADMIN',
    'FAIL',
    () => dbB.collection('professionals').doc(uidProfB).set({
      uid: uidProfB,
      email: emailProfB,
      name: 'Dra. Beatriz',
      role: 'admin',
      createdAt: new Date().toISOString(),
    }),
    'Tentativa de definir role: admin no cadastro foi bloqueada.'
  );

  await testAssertion(
    'FS_07_PROF_INJECT_UNEXPECTED_FIELD',
    'Bloqueio de campos inesperados fora da whitelist no perfil',
    'FIRESTORE',
    'AUTH',
    'FAIL',
    () => dbA.collection('professionals').doc(uidProfA).set({
      uid: uidProfA,
      email: emailProfA,
      name: 'Dra. Ana',
      createdAt: new Date().toISOString(),
      campoMaliciosoInjetado: 'payload_hacker',
    }),
    'Injeção de campo fora da whitelist foi rejeitada.'
  );

  await testAssertion(
    'FS_08_PROF_UPDATE_IMMUTABLE_FIELDS',
    'Imutabilidade de campos críticos no perfil (email, createdAt)',
    'FIRESTORE',
    'AUTH',
    'FAIL',
    () => dbA.collection('professionals').doc(uidProfA).update({
      email: 'outro_email@teste.com',
    }),
    'Alteração de e-mail cadastrado foi bloqueada pela imutabilidade.'
  );

  await testAssertion(
    'FS_09_PROF_DELETE_SELF_BLOCKED',
    'Bloqueio de autoexclusão de conta via cliente SDK',
    'FIRESTORE',
    'AUTH',
    'FAIL',
    () => dbA.collection('professionals').doc(uidProfA).delete(),
    'Tentativa de exclusão de perfil profissional foi barrada (restrita a admin).'
  );

  // [FS 10] Coleção Administrativa
  await testAssertion(
    'FS_10_ADMIN_COLLECTION_WRITE_BLOCKED',
    'Bloqueio absoluto de escrita em /admins pelo cliente',
    'FIRESTORE',
    'ADMIN',
    'FAIL',
    () => dbA.collection('admins').doc(uidProfA).set({
      email: emailProfA,
      createdAt: new Date().toISOString(),
    }),
    'Tentativa de gravar em /admins foi sumariamente rejeitada por allow write: if false.'
  );

  // [FS 11-13] Configurações (/settings)
  await testAssertion(
    'FS_11_SETTINGS_LEGITIMATE_CREATE',
    'Criação legítima de configurações com ID padronizado (UID)',
    'FIRESTORE',
    'ISOLAMENTO',
    'SUCCEED',
    () => dbA.collection('settings').doc(uidProfA).set({
      professionalId: uidProfA,
      salonName: 'Studio Capilar Ana',
      professionalName: 'Ana Silva',
      enableSenacBadge: true,
      defaultPauseTime: 30,
    }),
    'Configurações salvas vinculadas ao UID da profissional com sucesso.'
  );

  await testAssertion(
    'FS_12_SETTINGS_THIRD_PARTY_SPOOF',
    'Bloqueio de criação de configurações para terceiro',
    'FIRESTORE',
    'ISOLAMENTO',
    'FAIL',
    () => dbA.collection('settings').doc(uidProfB).set({
      professionalId: uidProfB,
      salonName: 'Studio Invasao',
    }),
    'Tentativa da Profissional A gravar /settings da Profissional B foi rejeitada.'
  );

  await testAssertion(
    'FS_13_SETTINGS_CROSS_READ',
    'Bloqueio de leitura de configurações de outra profissional',
    'FIRESTORE',
    'ISOLAMENTO',
    'FAIL',
    () => dbB.collection('settings').doc(uidProfA).get(),
    'Profissional B não conseguiu ler configurações da Profissional A.'
  );

  // [FS 14-18] Clientes (/clients)
  const clientAId = 'client-mariana-001';

  await testAssertion(
    'FS_14_CLIENT_LEGITIMATE_CREATE',
    'Criação legítima de cliente pela profissional proprietária',
    'FIRESTORE',
    'ISOLAMENTO',
    'SUCCEED',
    () => dbA.collection('clients').doc(clientAId).set({
      id: clientAId,
      professionalId: uidProfA,
      name: 'Mariana Silveira',
      phone: '(11) 98765-4321',
      email: 'mariana.silveira@email.com',
      age: 28,
      hairGoal: 'Recuperar brilho após descoloração.',
      createdAt: new Date().toISOString(),
    }),
    'Cliente criada com sucesso respeitando o schema e a titularidade.'
  );

  await testAssertion(
    'FS_15_CLIENT_CROSS_READ',
    'Bloqueio de leitura cruzada de cliente alheio',
    'FIRESTORE',
    'ISOLAMENTO',
    'FAIL',
    () => dbB.collection('clients').doc(clientAId).get(),
    'Profissional B foi bloqueada ao tentar ler cliente da Profissional A.'
  );

  await testAssertion(
    'FS_16_CLIENT_CROSS_UPDATE',
    'Bloqueio de atualização de cliente alheio',
    'FIRESTORE',
    'ISOLAMENTO',
    'FAIL',
    () => dbB.collection('clients').doc(clientAId).update({
      name: 'Mariana Nome Alterado',
    }),
    'Profissional B não conseguiu alterar cliente da Profissional A.'
  );

  await testAssertion(
    'FS_17_CLIENT_CROSS_DELETE',
    'Bloqueio de exclusão de cliente alheio',
    'FIRESTORE',
    'ISOLAMENTO',
    'FAIL',
    () => dbB.collection('clients').doc(clientAId).delete(),
    'Profissional B não conseguiu deletar cliente da Profissional A.'
  );

  await testAssertion(
    'FS_18_CLIENT_IMMUTABLE_OWNER',
    'Imutabilidade de professionalId no cliente (anti-transferência)',
    'FIRESTORE',
    'ISOLAMENTO',
    'FAIL',
    () => dbA.collection('clients').doc(clientAId).update({
      professionalId: uidProfB,
    }),
    'Tentativa de transferir cliente para outra conta foi bloqueada.'
  );

  // [FS 19-22] Avaliações (/evaluations) com campos reais (calculation, scores, treatmentSchedule)
  const evalAId = 'eval-mariana-001';

  await testAssertion(
    'FS_19_EVAL_LEGITIMATE_CREATE',
    'Criação legítima de avaliação vinculada à cliente da própria profissional',
    'FIRESTORE',
    'INTEGRIDADE',
    'SUCCEED',
    () => dbA.collection('evaluations').doc(evalAId).set({
      id: evalAId,
      professionalId: uidProfA,
      clientId: clientAId,
      clientName: 'Mariana Silveira',
      createdAt: new Date().toISOString(),
      anamnese: { scalpType: 'OLEOSO', washFrequency: '2_3_VEZES' },
      visual: { curvature: '2B', thickness: 'FINO', elasticity: 'BAIXA_EMBORRACHADO' },
      scores: { overallHealth: 45, healthGrade: 'C' },
      calculation: { overallHealth: 45, damageGrade: 'GRAU_3' },
      treatmentSchedule: { summary: 'Cronograma de 4 semanas focado em reconstrução lipídica' },
      aiInsights: { summary: 'Fibra desidratada com perda de massa cortical' },
      images: ['photos/' + uidProfA + '/clients/' + clientAId + '/facial.jpg'],
    }),
    'Avaliação criada com sucesso e validada pelo Master-Gate clientBelongsToProfessional.'
  );

  await testAssertion(
    'FS_20_EVAL_SPOOFED_CLIENT_CROSS_TENANT',
    'Bloqueio relacional: vincular avaliação a cliente de OUTRA profissional',
    'FIRESTORE',
    'INTEGRIDADE',
    'FAIL',
    () => dbB.collection('evaluations').doc('eval-spoof-002').set({
      id: 'eval-spoof-002',
      professionalId: uidProfB,
      clientId: clientAId, // Pertence à Profissional A!
      createdAt: new Date().toISOString(),
    }),
    'Validação relacional clientBelongsToProfessional barrou tentativa de vincular cliente alheio.'
  );

  await testAssertion(
    'FS_21_EVAL_CROSS_READ',
    'Bloqueio de leitura cruzada de avaliação alheia',
    'FIRESTORE',
    'ISOLAMENTO',
    'FAIL',
    () => dbB.collection('evaluations').doc(evalAId).get(),
    'Profissional B foi impedida de ler avaliação da Profissional A.'
  );

  await testAssertion(
    'FS_22_EVAL_IMMUTABILITY_UPDATE',
    'Imutabilidade de clientId e professionalId na avaliação',
    'FIRESTORE',
    'INTEGRIDADE',
    'FAIL',
    () => dbA.collection('evaluations').doc(evalAId).update({
      clientId: 'outro-cliente-alterado',
    }),
    'Tentativa de trocar clientId da avaliação existente foi bloqueada.'
  );

  // [FS 23-25] Produtos (/products) com campos reais (pH, price, stockQuantity)
  const prodAId = 'prod-acidificante-001';

  await testAssertion(
    'FS_23_PRODUCT_LEGITIMATE_CREATE',
    'Criação legítima de produto com campos reais (pH, price, stockQuantity)',
    'FIRESTORE',
    'ISOLAMENTO',
    'SUCCEED',
    () => dbA.collection('products').doc(prodAId).set({
      id: prodAId,
      professionalId: uidProfA,
      name: 'Acidificante Selante Cuticular',
      brand: 'Tricologia Pro',
      category: 'ACIDIFICANTE',
      targetUse: 'AMBOS',
      keyActives: 'Ácido Lático',
      description: 'Equilibra o pH alcalino pós-química.',
      pH: '3.0 - 3.5',
      price: 'R$ 89,90',
      stockQuantity: 15,
      createdAt: new Date().toISOString(),
      pauseTimeMinutes: 5,
      active: true,
      inStock: true,
    }),
    'Produto cadastrado com sucesso respeitando todos os tipos e campos obrigatórios.'
  );

  await testAssertion(
    'FS_24_PRODUCT_CROSS_READ',
    'Bloqueio de leitura cruzada de produto de outra profissional',
    'FIRESTORE',
    'ISOLAMENTO',
    'FAIL',
    () => dbB.collection('products').doc(prodAId).get(),
    'Profissional B foi impedida de ler produto da bancada da Profissional A.'
  );

  await testAssertion(
    'FS_25_PRODUCT_IMMUTABLE_OWNER',
    'Imutabilidade de professionalId no produto cadastrado',
    'FIRESTORE',
    'ISOLAMENTO',
    'FAIL',
    () => dbA.collection('products').doc(prodAId).update({
      professionalId: uidProfB,
    }),
    'Tentativa de transferir produto para outra conta foi bloqueada.'
  );

  // [FS 26-28] Consultas filtradas por professionalId (Query tests)
  await testAssertion(
    'FS_26_QUERY_OWN_CLIENTS_ALLOWED',
    'Consulta legítima de clientes filtrada por professionalId == auth.uid',
    'FIRESTORE',
    'QUERY',
    'SUCCEED',
    () => dbA.collection('clients').where('professionalId', '==', uidProfA).get(),
    'Consulta com filtro where(professionalId == auth.uid) autorizada nativamente.'
  );

  await testAssertion(
    'FS_27_QUERY_OTHER_CLIENTS_REJECTED',
    'Bloqueio de consulta filtrando professionalId de outra conta',
    'FIRESTORE',
    'QUERY',
    'FAIL',
    () => dbA.collection('clients').where('professionalId', '==', uidProfB).get(),
    'Consulta tentando listar clientes da Profissional B foi rejeitada.'
  );

  await testAssertion(
    'FS_28_QUERY_UNFILTERED_REJECTED',
    'Bloqueio de consulta sem filtro de professionalId (varredura ampla)',
    'FIRESTORE',
    'QUERY',
    'FAIL',
    () => dbA.collection('clients').get(),
    'Consulta sem filtro de isolamento foi bloqueada pelo Firestore Rules.'
  );

  // [FS 29-30] Exclusões Legítimas de Registros Próprios
  await testAssertion(
    'FS_29_EVAL_LEGITIMATE_DELETE',
    'Exclusão legítima de avaliação pela profissional proprietária',
    'FIRESTORE',
    'ISOLAMENTO',
    'SUCCEED',
    () => dbA.collection('evaluations').doc(evalAId).delete(),
    'Avaliação própria excluída com sucesso pela proprietária.'
  );

  await testAssertion(
    'FS_30_CLIENT_LEGITIMATE_DELETE',
    'Exclusão legítima de cliente pela profissional proprietária',
    'FIRESTORE',
    'ISOLAMENTO',
    'SUCCEED',
    () => dbA.collection('clients').doc(clientAId).delete(),
    'Cliente própria excluída com sucesso pela proprietária.'
  );

  // =========================================================================
  // SEÇÃO 2: FIREBASE STORAGE EMULATOR TESTS
  // =========================================================================

  const sampleJpegData = Buffer.from('FAKE_JPEG_IMAGE_BINARY_DATA_FOR_TESTS');
  const photoPathProfA = `photos/${uidProfA}/clients/c1/tricoscopia.jpg`;
  const photoPathProfB = `photos/${uidProfB}/clients/c2/tricoscopia.jpg`;

  // [ST 31-32] Usuários Anônimos no Storage
  await testAssertion(
    'ST_31_STORAGE_UNAUTH_UPLOAD',
    'Storage: Bloqueio de upload por usuário anônimo',
    'STORAGE',
    'AUTH',
    'FAIL',
    () => storageUnauth.ref(photoPathProfA).put(sampleJpegData, { contentType: 'image/jpeg' }),
    'Usuário não autenticado foi barrado ao tentar enviar foto para o Storage.'
  );

  await testAssertion(
    'ST_32_STORAGE_UNAUTH_DOWNLOAD',
    'Storage: Bloqueio de leitura de foto por usuário anônimo (Sem URL pública)',
    'STORAGE',
    'AUTH',
    'FAIL',
    () => storageUnauth.ref(photoPathProfA).getDownloadURL(),
    'Usuário não autenticado não conseguiu ler nem obter URL de fotografia tricológica.'
  );

  // [ST 33-35] Operações Legítimas da Profissional A no Storage
  await testAssertion(
    'ST_33_STORAGE_LEGITIMATE_UPLOAD',
    'Storage: Upload legítimo de fotografia tricolórica (< 5MB, JPEG)',
    'STORAGE',
    'ISOLAMENTO',
    'SUCCEED',
    () => storageA.ref(photoPathProfA).put(sampleJpegData, { contentType: 'image/jpeg' }),
    'Profissional A realizou upload de fotografia na sua pasta /photos/{uidProfA}/...'
  );

  await testAssertion(
    'ST_34_STORAGE_LEGITIMATE_GET_URL',
    'Storage: Obtenção de download URL pela proprietária autenticada',
    'STORAGE',
    'ISOLAMENTO',
    'SUCCEED',
    () => storageA.ref(photoPathProfA).getDownloadURL(),
    'Profissional A obteve acesso à sua própria foto através de sessão autenticada.'
  );

  await testAssertion(
    'ST_35_STORAGE_LEGITIMATE_UPDATE',
    'Storage: Atualização/Substituição legítima de fotografia pela proprietária',
    'STORAGE',
    'ISOLAMENTO',
    'SUCCEED',
    () => storageA.ref(photoPathProfA).put(sampleJpegData, { contentType: 'image/webp' }),
    'Profissional A atualizou sua foto existente mantendo formato permitido.'
  );

  // [ST 36-38] Tentativas Cruzadas entre Profissionais (Cross-tenant no Storage)
  await testAssertion(
    'ST_36_STORAGE_CROSS_DOWNLOAD',
    'Storage: Bloqueio de leitura de foto da Profissional A pela Profissional B',
    'STORAGE',
    'ISOLAMENTO',
    'FAIL',
    () => storageB.ref(photoPathProfA).getDownloadURL(),
    'Profissional B foi estritamente barrada ao tentar ler foto da Profissional A.'
  );

  await testAssertion(
    'ST_37_STORAGE_CROSS_UPLOAD',
    'Storage: Bloqueio de upload da Profissional B na pasta da Profissional A',
    'STORAGE',
    'ISOLAMENTO',
    'FAIL',
    () => storageB.ref(photoPathProfA).put(sampleJpegData, { contentType: 'image/jpeg' }),
    'Profissional B não conseguiu gravar arquivos na pasta da Profissional A.'
  );

  await testAssertion(
    'ST_38_STORAGE_CROSS_DELETE',
    'Storage: Bloqueio de exclusão de foto da Profissional A pela Profissional B',
    'STORAGE',
    'ISOLAMENTO',
    'FAIL',
    () => storageB.ref(photoPathProfA).delete(),
    'Profissional B não conseguiu deletar a fotografia da Profissional A.'
  );

  // [ST 39-40] Validações de Segurança: Tipo MIME e Tamanho Máximo (> 5MB)
  await testAssertion(
    'ST_39_STORAGE_INVALID_MIME',
    'Storage: Bloqueio de upload com MIME type proibido (text/plain ou executável)',
    'STORAGE',
    'STORAGE_MIME',
    'FAIL',
    () => storageA.ref(`photos/${uidProfA}/script.sh`).put(sampleJpegData, { contentType: 'text/plain' }),
    'Tentativa de upload de tipo MIME não listado na whitelist de imagens foi rejeitada.'
  );

  const oversizedData = Buffer.alloc(6 * 1024 * 1024); // 6MB (excede teto de 5MB)
  await testAssertion(
    'ST_40_STORAGE_OVERSIZED_FILE',
    'Storage: Bloqueio de upload com tamanho superior a 5MB',
    'STORAGE',
    'STORAGE_SIZE',
    'FAIL',
    () => storageA.ref(`photos/${uidProfA}/clients/c1/huge.jpg`).put(oversizedData, { contentType: 'image/jpeg' }),
    'Tentativa de upload de fotografia excedendo 5MB foi bloqueada pela regra de tamanho.'
  );

  // [ST 41] Exclusão Legítima pela Proprietária
  await testAssertion(
    'ST_41_STORAGE_LEGITIMATE_DELETE',
    'Storage: Exclusão legítima de fotografia pela proprietária',
    'STORAGE',
    'ISOLAMENTO',
    'SUCCEED',
    () => storageA.ref(photoPathProfA).delete(),
    'Profissional A excluiu sua fotografia com sucesso.'
  );

  await testEnv.cleanup();

  const passed = results.filter((r) => r.executionStatus === 'APROVADO').length;
  const failed = results.filter((r) => r.executionStatus === 'REJEITADO').length;
  const firestoreCount = results.filter((r) => r.emulator === 'FIRESTORE').length;
  const storageCount = results.filter((r) => r.emulator === 'STORAGE').length;

  return { results, passed, failed, firestoreCount, storageCount, blocked: false };
}

// Execução direta do script
if (import.meta.url === `file://${process.argv[1]}`) {
  runFullSecuritySuite().then(({ results, passed, failed, firestoreCount, storageCount, blocked }) => {
    console.log('========================================================================');
    console.log('   CAPILAR SMART IA — RESULTADOS OFICIAIS DOS TESTES (FIRESTORE & STORAGE)');
    console.log('========================================================================\n');

    if (blocked) {
      console.log('⚠️  SUÍTE BLOQUEADA:');
      console.log(results[0]?.details);
      process.exit(1);
    }

    console.log(`[EMULADOR FIRESTORE: ${firestoreCount} TESTES]`);
    results
      .filter((r) => r.emulator === 'FIRESTORE')
      .forEach((r, i) => {
        const sym = r.executionStatus === 'APROVADO' ? '✅' : '❌';
        console.log(`  [${i + 1}] ${sym} ${r.code}: ${r.name}`);
        console.log(`       Categoria: ${r.category} | Status: ${r.executionStatus}`);
        console.log(`       Detalhe: ${r.details}\n`);
      });

    console.log(`[EMULADOR STORAGE: ${storageCount} TESTES]`);
    results
      .filter((r) => r.emulator === 'STORAGE')
      .forEach((r, i) => {
        const sym = r.executionStatus === 'APROVADO' ? '✅' : '❌';
        console.log(`  [${i + 1}] ${sym} ${r.code}: ${r.name}`);
        console.log(`       Categoria: ${r.category} | Status: ${r.executionStatus}`);
        console.log(`       Detalhe: ${r.details}\n`);
      });

    console.log('------------------------------------------------------------------------');
    console.log(`RESUMO GERAL: ${passed} Aprovados (${firestoreCount} Firestore, ${storageCount} Storage) | ${failed} Rejeitados`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  });
}

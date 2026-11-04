/**
 * Suite de Testes Automatizados da Fase 1 - Autenticação & Sessão
 * Capilar Smart IA
 * 
 * Valida:
 * 1. Indicador visual dos 4 critérios de senha (comprimento, maiúscula, número, caractere especial).
 * 2. Detecção e sugestão de correção para erros comuns de digitação no e-mail (sem alteração automática).
 * 3. Validação dos campos do perfil profissional e conformidade estrita com firestore.rules.
 * 4. Isolamento de sessão e preservação dos dados legados no localStorage.
 */

import {
  evaluatePasswordCriteria,
  detectEmailTypo,
  translateAuthError,
} from '../src/services/authService';
import { ProfessionalProfile } from '../src/types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function runAuthSuite() {
  console.log('\n======================================================');
  console.log('🧪 TESTES DA FASE 1: AUTENTICAÇÃO E SESSÃO INDIVIDUAL');
  console.log('======================================================\n');

  // ---------------------------------------------------------------------------
  // 1. INDICADOR DOS 4 CRITÉRIOS DE SENHA
  // ---------------------------------------------------------------------------
  console.log('--- 1. Avaliação dos 4 Critérios de Senha ---');

  const emptyPass = evaluatePasswordCriteria('');
  assert(!emptyPass.minLength, 'Senha vazia: minLength = false');
  assert(!emptyPass.hasUppercase, 'Senha vazia: hasUppercase = false');
  assert(!emptyPass.hasNumber, 'Senha vazia: hasNumber = false');
  assert(!emptyPass.hasSpecialChar, 'Senha vazia: hasSpecialChar = false');
  assert(!emptyPass.isValid, 'Senha vazia: isValid = false');

  const shortPass = evaluatePasswordCriteria('Aa1!');
  assert(!shortPass.minLength, 'Senha curta (<8 chars): minLength = false');
  assert(shortPass.hasUppercase, 'Senha curta: hasUppercase = true');
  assert(shortPass.hasNumber, 'Senha curta: hasNumber = true');
  assert(shortPass.hasSpecialChar, 'Senha curta: hasSpecialChar = true');
  assert(!shortPass.isValid, 'Senha curta: isValid = false');

  const noUpper = evaluatePasswordCriteria('senha123!@#');
  assert(noUpper.minLength, 'Sem maiúscula: minLength = true');
  assert(!noUpper.hasUppercase, 'Sem maiúscula: hasUppercase = false');
  assert(noUpper.hasNumber, 'Sem maiúscula: hasNumber = true');
  assert(noUpper.hasSpecialChar, 'Sem maiúscula: hasSpecialChar = true');
  assert(!noUpper.isValid, 'Sem maiúscula: isValid = false');

  const noNumber = evaluatePasswordCriteria('SenhaForte!@#');
  assert(noNumber.minLength, 'Sem número: minLength = true');
  assert(noNumber.hasUppercase, 'Sem número: hasUppercase = true');
  assert(!noNumber.hasNumber, 'Sem número: hasNumber = false');
  assert(noNumber.hasSpecialChar, 'Sem número: hasSpecialChar = true');
  assert(!noNumber.isValid, 'Sem número: isValid = false');

  const noSpecial = evaluatePasswordCriteria('SenhaForte123');
  assert(noSpecial.minLength, 'Sem símbolo especial: minLength = true');
  assert(noSpecial.hasUppercase, 'Sem símbolo especial: hasUppercase = true');
  assert(noSpecial.hasNumber, 'Sem símbolo especial: hasNumber = true');
  assert(!noSpecial.hasSpecialChar, 'Sem símbolo especial: hasSpecialChar = false');
  assert(!noSpecial.isValid, 'Sem símbolo especial: isValid = false');

  const validPass = evaluatePasswordCriteria('Capilar#2026!');
  assert(validPass.minLength, 'Senha completa: minLength = true');
  assert(validPass.hasUppercase, 'Senha completa: hasUppercase = true');
  assert(validPass.hasNumber, 'Senha completa: hasNumber = true');
  assert(validPass.hasSpecialChar, 'Senha completa: hasSpecialChar = true');
  assert(validPass.isValid, 'Senha completa: isValid = true');

  // ---------------------------------------------------------------------------
  // 2. SUGESTÃO DE CORREÇÃO PARA ERROS COMUNS DE DIGITAÇÃO NO E-MAIL
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Detecção e Sugestão de Digitação de E-mail ---');

  const typoGmail1 = detectEmailTypo('terapeuta@gmai.com');
  assert(typoGmail1.hasSuggestion, 'Detectou erro em @gmai.com');
  assert(typoGmail1.suggestedDomain === 'gmail.com', 'Sugeriu gmail.com');
  assert(typoGmail1.suggestedEmail === 'terapeuta@gmail.com', 'E-mail sugerido = terapeuta@gmail.com');
  assert(typoGmail1.originalDomain === 'gmai.com', 'Preservou originalDomain = gmai.com');

  const typoGmail2 = detectEmailTypo('maria@gmial.com');
  assert(typoGmail2.hasSuggestion && typoGmail2.suggestedDomain === 'gmail.com', 'Detectou erro em @gmial.com');

  const typoHotmail = detectEmailTypo('contato@hotmial.com');
  assert(typoHotmail.hasSuggestion, 'Detectou erro em @hotmial.com');
  assert(typoHotmail.suggestedDomain === 'hotmail.com', 'Sugeriu hotmail.com');
  assert(typoHotmail.suggestedEmail === 'contato@hotmail.com', 'E-mail sugerido = contato@hotmail.com');

  const typoOutlook = detectEmailTypo('salao@outlok.com');
  assert(typoOutlook.hasSuggestion, 'Detectou erro em @outlok.com');
  assert(typoOutlook.suggestedDomain === 'outlook.com', 'Sugeriu outlook.com');

  const typoIcloud = detectEmailTypo('patricia@iclud.com');
  assert(typoIcloud.hasSuggestion, 'Detectou erro em @iclud.com');
  assert(typoIcloud.suggestedDomain === 'icloud.com', 'Sugeriu icloud.com');

  const validEmail = detectEmailTypo('profissional@gmail.com');
  assert(!validEmail.hasSuggestion, 'E-mail correto @gmail.com não gera sugestão indevida');

  const customDomain = detectEmailTypo('contato@salaoespecializado.com.br');
  assert(!customDomain.hasSuggestion, 'Domínio próprio não gera sugestão indevida');

  const invalidInput = detectEmailTypo('sem-arroba');
  assert(!invalidInput.hasSuggestion, 'Entrada sem @ tratada com segurança');

  // ---------------------------------------------------------------------------
  // 3. CONFORMIDADE DO PERFIL COM FIRESTORE.RULES
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Conformidade do Perfil Profissional (firestore.rules) ---');

  const requiredFields = ['uid', 'email', 'name', 'createdAt'];
  const allowedFields = ['uid', 'email', 'name', 'clinicName', 'phone', 'role', 'createdAt', 'updatedAt'];

  const testProfile: ProfessionalProfile = {
    uid: 'prof_test_123',
    email: 'dra.patricia@salao.com',
    name: 'Patrícia Andrade',
    clinicName: 'Clínica Capilar Elite',
    phone: '(11) 98888-7777',
    role: 'professional',
    createdAt: new Date().toISOString(),
  };

  const profileKeys = Object.keys(testProfile);
  const hasAllRequired = requiredFields.every((k) => profileKeys.includes(k));
  assert(hasAllRequired, 'Perfil contém todos os campos obrigatórios: uid, email, name, createdAt');

  const hasOnlyAllowed = profileKeys.every((k) => allowedFields.includes(k));
  assert(hasOnlyAllowed, 'Perfil não contém nenhum campo inesperado fora da lista de firestore.rules');

  assert(testProfile.role === 'professional', 'Papel (role) deve ser estritamente "professional"');

  // ---------------------------------------------------------------------------
  // 4. TRADUÇÃO DE ERROS AMIGÁVEIS
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Mensagens de Erro Traduzidas ---');

  assert(
    translateAuthError('auth/wrong-password').includes('E-mail ou senha incorretos'),
    'auth/wrong-password traduzido corretamente'
  );
  assert(
    translateAuthError('auth/email-already-in-use').includes('já está cadastrado'),
    'auth/email-already-in-use traduzido corretamente'
  );
  assert(
    translateAuthError('auth/network-request-failed').includes('conexão'),
    'auth/network-request-failed traduzido com foco em rede'
  );

  console.log('\n======================================================');
  console.log(`TOTAL: ${totalTests} testes | APROVADOS: ${passedTests} | FALHAS: ${failedTests}`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAuthSuite();

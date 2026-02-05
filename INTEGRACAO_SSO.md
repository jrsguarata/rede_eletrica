# Guia de Integracao SSO com SignOn

## Contexto

O **SignOn** e um sistema de autenticacao centralizada (SSO) que gerencia usuarios, empresas e aplicacoes. Aplicacoes externas registradas no SignOn podem autenticar usuarios sem possuir sistema de login proprio.

Este documento descreve como integrar uma aplicacao externa que **nao possui JWT** com o SignOn, para que o acesso e uso da aplicacao ocorra a partir do painel do SignOn.

---

## 1. Visao Geral do Fluxo

```
Usuario                SignOn                 App Externa
  |                      |                        |
  |-- Clica "Acessar" -->|                        |
  |                      |-- Valida acesso         |
  |                      |                        |
  |-- Navega na mesma aba (sso_token + return_url)->|
  |   (SignOn sai de cena)                         |
  |                      |                        |
  |                      |<-- POST /validate ------|
  |                      |    (token + api_key)    |
  |                      |                        |
  |                      |-- Retorna dados user -->|
  |                      |                        |
  |                      |    Cria sessao local    |
  |<-------------- Exibe app autenticada ---------|
  |                                               |
  |               ... usa o app ...               |
  |                                               |
  |<-- Clica "Voltar ao SignOn" (return_url) ------|
  |                      |                        |
  |-- SignOn recarrega -->|                        |
  |   (mesma tela)       |                        |
```

### Passo a passo:

1. O usuario acessa o painel do SignOn (`http://localhost:5178/dashboard/my-apps`)
2. Clica em "Acessar" na aplicacao desejada
3. O SignOn **navega na mesma aba** para a URL da aplicacao, adicionando os parametros `?sso_token={jwt_token}&return_url={url_atual_do_signon}`
4. O SignOn "sai de cena" — a aba agora mostra a aplicacao externa
5. A aplicacao recebe o token e o `return_url` via query string
6. A aplicacao chama o endpoint `POST /api/auth/validate` do SignOn para validar o token
7. O SignOn retorna os dados do usuario autenticado
8. A aplicacao cria uma sessao local (cookie, session, etc.), **salva o `return_url` na sessao**, e redireciona o usuario para a pagina principal
9. Quando o usuario quiser voltar, clica em "Voltar ao SignOn" e e redirecionado para a tela exata de onde saiu

---

## 2. Pre-requisitos

### 2.1 Aplicacao registrada no SignOn

A aplicacao deve estar cadastrada no painel admin do SignOn (`/dashboard/applications`). Cada aplicacao possui:

| Campo | Descricao |
|-------|-----------|
| `name` | Nome da aplicacao |
| `url` | URL base da aplicacao (ex: `http://localhost:3001`) |
| `apiKey` | Chave unica da API gerada automaticamente pelo SignOn |
| `active` | Deve estar ativa |

### 2.2 Aplicacao vinculada a empresa

No painel de Companhias (`/dashboard/companies`), a aplicacao deve estar associada (licenciada) a empresa do usuario. Isso e feito pelo botao de "Aplicacoes Licenciadas" (icone roxo) na tabela de companhias.

### 2.3 Informacoes necessarias

Para integrar, voce precisa de:

- **URL do SignOn**: `http://localhost:3004` (backend)
- **API Key da aplicacao**: Obtida no painel admin do SignOn em Aplicacoes (icone de olho para visualizar)
- **URL da aplicacao**: Deve corresponder ao campo `url` cadastrado no SignOn

---

## 3. Endpoint de Validacao do SignOn

### `POST http://localhost:3004/api/auth/validate`

Este e o endpoint que a aplicacao externa deve chamar para validar o token SSO.

**Headers:**
```
Content-Type: application/json
x-api-key: {API_KEY_DA_APLICACAO}
```

**Body:**
```json
{
  "token": "{sso_token_recebido_na_url}"
}
```

**Resposta de sucesso (200):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "id": "ba10e752-fc2a-4d20-a394-f806214d73c8",
      "email": "admin@empresaexemplo.com",
      "name": "Joao Silva",
      "role": "COMPANY_ADMIN",
      "companyId": "32c8fd85-3d17-4dd9-89de-e586b5cd5243"
    }
  }
}
```

**Respostas de erro:**

| Status | Erro | Quando |
|--------|------|--------|
| 400 | `Token e API Key sao obrigatorios` | Faltou `token` no body ou `x-api-key` no header |
| 401 | `API Key invalida` | API Key nao existe ou aplicacao inativa |
| 401 | `Token invalido` | JWT expirado, malformado ou nao e access token |
| 403 | `Usuario nao tem acesso a esta aplicacao` | Empresa do usuario nao tem esta aplicacao licenciada |

### Exemplo com cURL:

```bash
curl -X POST http://localhost:3004/api/auth/validate \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk_signon_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -d '{"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'
```

---

## 4. Estrutura do Token JWT (Referencia)

O `sso_token` e um JWT assinado com HS256. Seu payload contem:

```json
{
  "sub": "ba10e752-fc2a-4d20-a394-f806214d73c8",
  "email": "admin@empresaexemplo.com",
  "name": "Joao Silva",
  "role": "COMPANY_ADMIN",
  "companyId": "32c8fd85-3d17-4dd9-89de-e586b5cd5243",
  "companyName": "Empresa Exemplo LTDA",
  "type": "access",
  "iat": 1770202299,
  "exp": 1770203199
}
```

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `sub` | string (UUID) | ID do usuario |
| `email` | string | Email do usuario |
| `name` | string | Nome completo |
| `role` | enum | `SUPER_ADMIN`, `COMPANY_ADMIN` ou `COMPANY_OPERATOR` |
| `companyId` | string/null | ID da empresa (null para SUPER_ADMIN) |
| `companyName` | string/null | Nome da empresa |
| `type` | string | Sempre `"access"` |
| `exp` | number | Expiracao (Unix timestamp). Padrao: 15 minutos apos emissao |

> **IMPORTANTE**: A aplicacao externa NAO deve decodificar o JWT localmente. Deve sempre usar o endpoint `/api/auth/validate` para validar, pois este endpoint tambem verifica se o usuario tem acesso a aplicacao e se a API Key e valida.

---

## 5. Alteracoes Necessarias na Aplicacao Externa

### 5.1 Rota de Callback SSO

Criar uma rota que receba o `sso_token` e o `return_url` da query string, valide no SignOn, e crie uma sessao local.

**URL recebida pelo app externo:**
```
http://localhost:3001/?sso_token=eyJhb...&return_url=http://localhost:5178/dashboard/my-apps
```

**Se a aplicacao usa Express.js (Node.js):**

```typescript
// Adicionar dependencias se ainda nao existem:
// npm install express-session axios

import axios from 'axios';
import session from 'express-session';

// Configuracao de sessao (se nao existir)
app.use(session({
  secret: 'sua-chave-secreta-aqui',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // true em producao com HTTPS
    maxAge: 8 * 60 * 60 * 1000, // 8 horas
  },
}));

// Configuracao do SignOn
const SIGNON_API_URL = 'http://localhost:3004/api';
const SIGNON_API_KEY = 'sk_signon_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Sua API Key

// Rota de callback SSO
app.get('/sso/callback', async (req, res) => {
  const { sso_token, return_url } = req.query;

  if (!sso_token) {
    return res.status(400).send('Token SSO nao fornecido');
  }

  try {
    // Validar token no SignOn
    const response = await axios.post(`${SIGNON_API_URL}/auth/validate`, {
      token: sso_token,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SIGNON_API_KEY,
      },
    });

    if (response.data.success && response.data.data.valid) {
      const user = response.data.data.user;

      // Criar sessao local
      req.session.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      };
      req.session.authenticated = true;

      // Salvar return_url para o botao "Voltar ao SignOn"
      if (return_url && typeof return_url === 'string') {
        req.session.returnUrl = return_url;
      }

      // Redirecionar para pagina principal
      return res.redirect('/');
    }

    return res.status(401).send('Token SSO invalido');
  } catch (error) {
    const message = error.response?.data?.error || 'Erro ao validar token SSO';
    return res.status(401).send(message);
  }
});
```

**Se a aplicacao usa Python (Flask):**

```python
import requests
from flask import Flask, request, redirect, session

SIGNON_API_URL = 'http://localhost:3004/api'
SIGNON_API_KEY = 'sk_signon_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'

@app.route('/sso/callback')
def sso_callback():
    sso_token = request.args.get('sso_token')
    return_url = request.args.get('return_url')

    if not sso_token:
        return 'Token SSO nao fornecido', 400

    try:
        response = requests.post(
            f'{SIGNON_API_URL}/auth/validate',
            json={'token': sso_token},
            headers={
                'Content-Type': 'application/json',
                'x-api-key': SIGNON_API_KEY,
            },
        )

        data = response.json()

        if data.get('success') and data.get('data', {}).get('valid'):
            user = data['data']['user']
            session['user'] = {
                'id': user['id'],
                'email': user['email'],
                'name': user['name'],
                'role': user['role'],
                'company_id': user.get('companyId'),
            }
            session['authenticated'] = True

            # Salvar return_url para o botao "Voltar ao SignOn"
            if return_url:
                session['return_url'] = return_url

            return redirect('/')

        return 'Token SSO invalido', 401

    except Exception as e:
        return f'Erro ao validar token SSO: {str(e)}', 401
```

**Se a aplicacao usa PHP:**

```php
<?php
// sso_callback.php
session_start();

$sso_token = $_GET['sso_token'] ?? null;
$return_url = $_GET['return_url'] ?? null;
$SIGNON_API_URL = 'http://localhost:3004/api';
$SIGNON_API_KEY = 'sk_signon_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

if (!$sso_token) {
    http_response_code(400);
    die('Token SSO nao fornecido');
}

$ch = curl_init("$SIGNON_API_URL/auth/validate");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        "x-api-key: $SIGNON_API_KEY",
    ],
    CURLOPT_POSTFIELDS => json_encode(['token' => $sso_token]),
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($response, true);

if ($httpCode === 200 && $data['success'] && $data['data']['valid']) {
    $user = $data['data']['user'];
    $_SESSION['user'] = $user;
    $_SESSION['authenticated'] = true;

    // Salvar return_url para o botao "Voltar ao SignOn"
    if ($return_url) {
        $_SESSION['return_url'] = $return_url;
    }

    header('Location: /');
    exit;
}

http_response_code(401);
die('Token SSO invalido');
```

### 5.2 Middleware de Autenticacao

Proteger as rotas da aplicacao para que somente usuarios autenticados via SSO possam acessar.

**Express.js:**

```typescript
// Middleware de autenticacao
function requireAuth(req, res, next) {
  if (req.session?.authenticated && req.session?.user) {
    // Usuario autenticado
    req.user = req.session.user;
    return next();
  }

  // Verificar se ha sso_token na query (primeiro acesso via SignOn)
  if (req.query.sso_token) {
    const params = new URLSearchParams();
    params.set('sso_token', req.query.sso_token);
    if (req.query.return_url) params.set('return_url', req.query.return_url);
    return res.redirect(`/sso/callback?${params.toString()}`);
  }

  // Nao autenticado - redirecionar para mensagem de erro
  return res.status(401).send(
    'Acesso nao autorizado. Acesse esta aplicacao pelo painel do SignOn.'
  );
}

// Aplicar em todas as rotas (exceto callback SSO)
app.use((req, res, next) => {
  if (req.path === '/sso/callback') return next();
  requireAuth(req, res, next);
});
```

**Flask (Python):**

```python
from functools import wraps
from flask import session, request, redirect
from urllib.parse import urlencode

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('authenticated') and session.get('user'):
            return f(*args, **kwargs)

        sso_token = request.args.get('sso_token')
        if sso_token:
            params = {'sso_token': sso_token}
            return_url = request.args.get('return_url')
            if return_url:
                params['return_url'] = return_url
            return redirect(f'/sso/callback?{urlencode(params)}')

        return 'Acesso nao autorizado. Acesse pelo painel do SignOn.', 401
    return decorated

# Usar em cada rota:
@app.route('/')
@require_auth
def index():
    user = session['user']
    return f'Bem-vindo, {user["name"]}!'
```

### 5.3 Botao "Voltar ao SignOn"

A aplicacao deve exibir um botao/link que redireciona o usuario de volta ao SignOn na tela exata de onde ele veio. O `return_url` foi salvo na sessao durante o callback SSO.

**Express.js (exemplo em template EJS/Pug/HTML):**

```html
<!-- No header/navbar da aplicacao -->
<a href="/voltar-signon" class="btn">Voltar ao SignOn</a>
```

```typescript
// Rota que redireciona de volta ao SignOn
app.get('/voltar-signon', (req, res) => {
  const returnUrl = req.session.returnUrl || 'http://localhost:5178/dashboard';

  // Destruir sessao local antes de voltar
  req.session.destroy(() => {
    res.redirect(returnUrl);
  });
});
```

**Flask (Python):**

```python
@app.route('/voltar-signon')
def voltar_signon():
    return_url = session.get('return_url', 'http://localhost:5178/dashboard')
    session.clear()
    return redirect(return_url)
```

**PHP:**

```php
<?php
// voltar_signon.php
session_start();
$return_url = $_SESSION['return_url'] ?? 'http://localhost:5178/dashboard';
session_destroy();
header("Location: $return_url");
exit;
```

> **Nota**: Ao voltar ao SignOn, a sessao do usuario no SignOn ainda esta ativa (tokens no localStorage do navegador). O SignOn detecta automaticamente e exibe a tela sem pedir login novamente.

### 5.4 Rota de Logout Local

```typescript
// Express.js - logout que volta ao SignOn
app.get('/logout', (req, res) => {
  const returnUrl = req.session.returnUrl || 'http://localhost:5178/dashboard';
  req.session.destroy(() => {
    res.redirect(returnUrl);
  });
});
```

### 5.5 Acessar Dados do Usuario nas Views

Apos autenticado, os dados do usuario ficam disponiveis na sessao:

```typescript
// Express.js - em qualquer rota protegida
app.get('/perfil', requireAuth, (req, res) => {
  const user = req.session.user;
  // user.id       -> UUID do usuario
  // user.email    -> Email
  // user.name     -> Nome completo
  // user.role     -> SUPER_ADMIN | COMPANY_ADMIN | COMPANY_OPERATOR
  // user.companyId -> UUID da empresa (null para SUPER_ADMIN)

  const returnUrl = req.session.returnUrl;
  // returnUrl -> URL do SignOn para o botao "Voltar"
});
```

---

## 6. Configurar a URL da Aplicacao no SignOn

A URL cadastrada no SignOn para a aplicacao deve apontar para a rota de callback SSO. Ha duas opcoes:

### Opcao A: URL aponta direto para a raiz

Cadastrar a URL como `http://localhost:3001` (raiz da aplicacao).
O middleware `requireAuth` ira capturar o `sso_token` da query string e redirecionar para `/sso/callback`.

### Opcao B: URL aponta para o callback

Cadastrar a URL como `http://localhost:3001/sso/callback`.
O usuario sera redirecionado diretamente para o callback, que valida e redireciona para `/`.

**Recomendacao**: Use a **Opcao A** (raiz), pois assim qualquer URL da aplicacao funcionara com o middleware de interceptacao.

---

## 7. Configuracoes de CORS (se aplicavel)

Se a aplicacao externa precisar fazer chamadas ao SignOn (alem da validacao server-side), configure o CORS no SignOn para aceitar a origem da aplicacao. Atualmente o SignOn aceita `http://localhost:5178` (frontend). Para adicionar origens extras, altere o `CORS_ORIGIN` no `docker-compose.yml`:

```yaml
CORS_ORIGIN: http://localhost:5178,http://localhost:3001
```

> Nota: A validacao do token e feita server-side (backend para backend), entao normalmente NAO e necessario alterar o CORS.

---

## 8. Checklist de Integracao

- [ ] Aplicacao registrada no SignOn (admin > Aplicacoes)
- [ ] API Key anotada
- [ ] Aplicacao vinculada a empresa do usuario (admin > Companhias > icone roxo)
- [ ] Rota `/sso/callback` implementada na aplicacao externa (recebendo `sso_token` e `return_url`)
- [ ] Middleware de autenticacao protegendo rotas
- [ ] Botao "Voltar ao SignOn" implementado (usando `return_url` da sessao)
- [ ] URL da aplicacao configurada corretamente no SignOn
- [ ] Testar fluxo completo: SignOn > Acessar app > Usar app > Voltar ao SignOn (mesma tela)

---

## 9. Exemplo: Teste Manual com cURL

```bash
# 1. Fazer login no SignOn
LOGIN=$(curl -s -X POST http://localhost:3004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresaexemplo.com","password":"Admin@123"}')

# 2. Extrair o access token
TOKEN=$(echo $LOGIN | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# 3. Validar o token como se fosse a aplicacao externa
curl -s -X POST http://localhost:3004/api/auth/validate \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_API_KEY_AQUI" \
  -d "{\"token\": \"$TOKEN\"}" | python3 -m json.tool
```

---

## 10. Seguranca

- O `sso_token` e um JWT com **15 minutos** de validade. Apos este tempo, o token expira e o usuario precisara acessar novamente pelo SignOn.
- A sessao local da aplicacao pode ter duracao maior (ex: 8 horas). Enquanto a sessao local estiver ativa, o usuario nao precisa do token SSO novamente.
- Sempre valide o token via endpoint do SignOn (server-side). **Nunca confie apenas na decodificacao local do JWT.**
- A API Key deve ser mantida em segredo (variavel de ambiente, nao commitada no codigo).
- Use HTTPS em producao.

---

## 11. Roles e Permissoes

O campo `role` retornado pelo SignOn pode ser usado para controlar acesso dentro da aplicacao:

| Role | Descricao |
|------|-----------|
| `SUPER_ADMIN` | Administrador global do SignOn |
| `COMPANY_ADMIN` | Administrador da empresa |
| `COMPANY_OPERATOR` | Operador da empresa |

A aplicacao externa pode mapear estes roles para seus proprios niveis de acesso:

```typescript
function getLocalRole(signonRole: string): string {
  switch (signonRole) {
    case 'SUPER_ADMIN':
    case 'COMPANY_ADMIN':
      return 'admin';
    case 'COMPANY_OPERATOR':
      return 'user';
    default:
      return 'user';
  }
}
```

---

## 12. Troubleshooting

| Problema | Causa | Solucao |
|----------|-------|---------|
| `Token e API Key sao obrigatorios` | Faltou `x-api-key` header ou `token` no body | Verificar headers e body da requisicao |
| `API Key invalida` | API Key nao corresponde a nenhuma aplicacao ativa | Verificar API Key no painel do SignOn |
| `Token invalido` | JWT expirado ou malformado | Usuario deve acessar novamente pelo SignOn |
| `Usuario nao tem acesso` | Empresa do usuario nao tem a app licenciada | Associar a app a empresa no painel admin |
| Sessao nao persiste | Configuracao de sessao incorreta | Verificar `express-session` ou equivalente |
| "Voltar ao SignOn" nao funciona | `return_url` nao foi salvo na sessao | Verificar se o callback SSO salva `req.query.return_url` |
| Ao voltar, SignOn pede login | Tokens no localStorage expiraram | O refresh token dura 7 dias; se expirou, e necessario logar de novo |

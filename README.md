# Gratao Flow

## Sobre

Gratao Flow e um sistema de gestao de producao para malharia, incluindo corte, serigrafia, confeccao, terceirizacao, estoque e financeiro.

## Como rodar

Defina uma `SECRET_KEY` forte e as credenciais iniciais do admin antes de subir o ambiente. Nao use valores padrao em producao.

```bash
ENVIRONMENT=development
SECRET_KEY=change_me_generate_a_strong_random_secret
ADMIN_EMAIL=admin@gratao.local
ADMIN_PASSWORD=change_me_strong_password
ADMIN_NAME=Administrador
POSTGRES_PASSWORD=change_me_strong_database_password
CORS_ORIGINS=http://localhost:3000
```

```bash
docker compose -f docker/docker-compose.yml up --build -d
```

O backend executa as migrations e o seed base automaticamente ao iniciar. A API usa `SECRET_KEY` para assinar JWTs, e o seed cria o admin inicial usando `ADMIN_EMAIL` e `ADMIN_PASSWORD`; se alguma dessas variaveis nao estiver definida, a inicializacao falha claramente.

## 🔐 Configuração de Produção

Para deploy controlado, defina `ENVIRONMENT=production` antes de subir os containers.

Use uma `SECRET_KEY` forte e unica, defina `POSTGRES_PASSWORD` com uma senha forte e configure `CORS_ORIGINS` apenas com o dominio real do frontend, por exemplo `https://seudominio.com`. Em producao, `/docs`, `/redoc` e `/openapi.json` sao desativados automaticamente.

## Deploy

O deploy real deve usar PostgreSQL gerenciado, backend FastAPI em um Web Service e frontend Next.js em outro Web Service. O backend inicia com `alembic upgrade head`, aplica o seed base seguro e sobe com `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`.

Variaveis obrigatorias do backend:

```bash
ENVIRONMENT=production
SECRET_KEY=change_me_generate_a_strong_random_secret
DATABASE_URL=postgresql+psycopg://user:password@host:5432/database
ADMIN_EMAIL=admin@seudominio.com
ADMIN_PASSWORD=change_me_strong_password
ADMIN_NAME=Administrador
CORS_ORIGINS=https://seu-frontend.example.com
```

Variaveis obrigatorias do frontend:

```bash
NEXT_PUBLIC_API_URL=https://sua-api.example.com
```

Banco:

* PostgreSQL gerenciado.
* O banco vazio recebe as migrations no startup do backend.
* O seed base cria produtos, tamanhos, servicos e o admin definido por env.
* `CORS_ORIGINS` deve conter somente origens reais do frontend; nao use `*`.

## Acesso

* Frontend: http://localhost:3000
* Backend: http://localhost:8000/docs

## Login

Use o email e a senha definidos em `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

Se existir um banco local antigo criado com credenciais de teste, resete o banco local e recrie o seed com novas variaveis.

## Fluxo basico

1. Criar cliente
2. Criar OS
3. Registrar corte
4. Registrar serigrafia
5. Registrar confeccao
6. Adicionar pagamento
7. Usar terceirizacao, se necessario
8. Acompanhar estoque
9. Registrar funcionarios
10. Fechar semana

## Limpeza do banco para demonstracao

Para remover dados de teste e voltar ao seed base:

```powershell
.\scripts\reset-database.ps1
```

Esse procedimento remove o volume do PostgreSQL, recria o ambiente com Docker Compose, roda todas as migrations e aplica o seed base com produtos, tamanhos, servicos e usuario admin.

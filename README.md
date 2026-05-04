# Gratao Flow

## Sobre

Gratao Flow e um sistema de gestao de producao para malharia, incluindo corte, serigrafia, confeccao, terceirizacao, estoque e financeiro.

## Como rodar

Defina uma `SECRET_KEY` forte e as credenciais iniciais do admin antes de subir o ambiente. Nao use valores padrao em producao.

```bash
SECRET_KEY=change_me_generate_a_strong_random_secret
ADMIN_EMAIL=admin@gratao.local
ADMIN_PASSWORD=change_me_strong_password
```

```bash
docker compose -f docker/docker-compose.yml up --build -d
```

O backend executa as migrations e o seed base automaticamente ao iniciar. A API usa `SECRET_KEY` para assinar JWTs, e o seed cria o admin inicial usando `ADMIN_EMAIL` e `ADMIN_PASSWORD`; se alguma dessas variaveis nao estiver definida, a inicializacao falha claramente.

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

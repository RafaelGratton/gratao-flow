# Gratão Flow

## Sobre

Gratão Flow é um sistema de gestão de produção para malharia, incluindo corte, serigrafia, confecção, terceirização, estoque e financeiro.

## Como rodar

```bash
docker compose -f docker/docker-compose.yml up --build -d
```

O backend executa as migrations e o seed base automaticamente ao iniciar.

## Acesso

* Frontend: http://localhost:3000
* Backend: http://localhost:8000/docs

## Login

* email: admin@gratao.local
* senha: admin123

## Fluxo básico

1. Criar cliente
2. Criar OS
3. Registrar corte
4. Registrar serigrafia
5. Registrar confecção
6. Adicionar pagamento
7. Usar terceirização, se necessário
8. Acompanhar estoque
9. Registrar funcionários
10. Fechar semana

## Limpeza do banco para demonstração

Para remover dados de teste e voltar ao seed base:

```powershell
.\scripts\reset-database.ps1
```

Esse procedimento remove o volume do PostgreSQL, recria o ambiente com Docker Compose, roda todas as migrations e aplica o seed base com produtos, tamanhos, serviços e usuário admin.

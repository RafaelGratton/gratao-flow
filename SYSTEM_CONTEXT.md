# GRATÃO FLOW - SYSTEM CONTEXT

## IDENTIDADE DO SISTEMA

Nome: Gratão Flow
Empresa: Gratão Uniformes
Tipo: Sistema de gestão de produção para malharia

Objetivo:

Controlar todo o fluxo operacional:

Ordem de Serviço -> Produção -> Financeiro -> Entrega

---

## STACK TECNOLÓGICA

Backend:

* Python 3.11
* FastAPI
* SQLAlchemy 2.0
* PostgreSQL
* Alembic
* Pydantic
* JWT Auth
* Passlib (bcrypt==4.0.1)

Infra:

* Docker
* Docker Compose

Frontend:

* Next.js
* TypeScript
* Tailwind

---

## PRINCÍPIOS DO SISTEMA

1. Simplicidade operacional
2. Dados consistentes > features
3. Regras de negócio explícitas
4. Nada implícito ou "mágico"
5. Histórico sempre registrado (auditável)

---

## REGRA CENTRAL

Uma Ordem de Serviço (OS) NÃO mistura produtos.

Exemplo correto:

* OS 001 -> 60 Blusas
* OS 002 -> 40 Shorts
* OS 003 -> 100 Casacos

---

## MODELO DE NEGÓCIO

A Gratão Uniformes presta serviços:

* Corte
* Serigrafia (DTF)
* Confecção local
* Terceirização

---

## SERVIÇOS PADRÃO

* Corte -> R$ 1,00 por peça
* Confecção -> R$ 5,00 por peça
* Serigrafia frente -> R$ 1,50 por peça
* Serigrafia frente e costas -> R$ 3,00 por peça

Regras:

* Sempre por peça
* Preço fixo
* Preço é congelado na criação da OS

---

## FLUXO DE PRODUÇÃO

### Com serigrafia:

created
-> in_cut
-> cut_done
-> waiting_print
-> in_print
-> print_done
-> waiting_sewing
-> in_sewing
-> sewing_done
-> ready
-> delivered

---

### Sem serigrafia:

created
-> in_cut
-> cut_done
-> waiting_sewing
-> in_sewing
-> sewing_done
-> ready
-> delivered

---

## REGRAS DE PRODUÇÃO

### CORTE

* quantity_cut pode ser maior que solicitado
* excedente vira estoque
* gera evento: cut_registered

---

### SERIGRAFIA

Regras por produto:

* Blusa -> frente ou frente e costas
* Casaco -> apenas frente
* Calça/Short/Short saia -> NÃO permitido

Exceção:

* allow_printing_exception = true

Validações:

* não pode imprimir sem corte
* não pode imprimir mais que cortado

Eventos:

* print_registered

---

### CONFECÇÃO

Regras:

* Se houver serigrafia -> só após print_done
* Se não houver -> após cut_done

Validações:

* não pode costurar mais que permitido
* respeitar dependência da serigrafia

Eventos:

* sewing_registered

---

## REGRAS FINANCEIRAS

### Cálculo

Total da OS = soma dos serviços

Cada serviço:

total = quantity x unit_price

---

### Preço congelado

* preço do serviço é copiado na criação da OS
* mudanças futuras não afetam OS existentes

---

### Pagamentos

* pagamentos são acumulativos
* podem ser parciais

Status:

* pending -> 0 pago
* partial -> pago < total
* paid -> pago >= total

---

## REGRAS DE STATUS

production_status:

* created
* in_cut
* cut_done
* waiting_print
* in_print
* print_done
* waiting_sewing
* in_sewing
* sewing_done
* ready
* delivered
* cancelled

financial_status:

* pending
* partial
* paid

---

## EVENTOS PRODUTIVOS

Todos os eventos devem ser registrados:

* cut_registered
* print_registered
* sewing_registered
* status_changed

Cada evento contém:

* tipo
* quantidade
* notas
* timestamp

---

## CONVENÇÕES TÉCNICAS

* Usar Decimal para valores monetários
* Nunca usar float para dinheiro
* Sempre usar enums para status
* Sempre criar migrations novas (nunca editar antigas)
* Nunca apagar dados existentes em migrations
* Validar dados no schema (Pydantic)
* Backend deve ser stateless

---

## REGRAS DE SEGURANÇA

* Todas as rotas protegidas por JWT
* Apenas admin por enquanto
* Sem acesso público

---

## O QUE NÃO FAZER

* Não misturar produtos em uma OS
* Não recalcular preço de OS antiga
* Não pular etapas do fluxo produtivo
* Não permitir inconsistência de quantidade
* Não ignorar eventos produtivos

---

## ROADMAP (VISÃO FUTURA)

* Terceirização completa
* Controle de estoque automático
* Fechamento semanal
* Dashboard
* Relatórios
* PDF para cliente
* Frontend completo

---

## INSTRUÇÃO PARA O CODEX

Sempre que executar qualquer tarefa:

1. Ler este arquivo primeiro
2. Respeitar todas as regras descritas
3. Não violar fluxo de produção
4. Não alterar decisões arquiteturais sem instrução explícita

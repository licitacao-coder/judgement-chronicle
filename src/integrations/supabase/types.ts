export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      auditoria: {
        Row: {
          acao: string
          campo_alterado: string | null
          created_at: string
          entidade: string | null
          entidade_id: string | null
          id: string
          ip: string | null
          user_agent: string | null
          usuario_id: string | null
          usuario_nome: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          acao: string
          campo_alterado?: string | null
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          acao?: string
          campo_alterado?: string | null
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: []
      }
      configuracao_motor: {
        Row: {
          created_at: string
          endereco_servico: string | null
          id: string
          mensagem_verificacao: string | null
          motor_padrao: string
          observacoes: string | null
          situacao: string
          ultima_verificacao: string | null
          updated_at: string
          usuario_atualizacao: string | null
          versao_servico: string | null
        }
        Insert: {
          created_at?: string
          endereco_servico?: string | null
          id?: string
          mensagem_verificacao?: string | null
          motor_padrao?: string
          observacoes?: string | null
          situacao?: string
          ultima_verificacao?: string | null
          updated_at?: string
          usuario_atualizacao?: string | null
          versao_servico?: string | null
        }
        Update: {
          created_at?: string
          endereco_servico?: string | null
          id?: string
          mensagem_verificacao?: string | null
          motor_padrao?: string
          observacoes?: string | null
          situacao?: string
          ultima_verificacao?: string | null
          updated_at?: string
          usuario_atualizacao?: string | null
          versao_servico?: string | null
        }
        Relationships: []
      }
      configuracao_template: {
        Row: {
          ativo: boolean
          campos: Json
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          secoes: Json
          updated_at: string
          usuario_atualizacao: string | null
        }
        Insert: {
          ativo?: boolean
          campos?: Json
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          secoes?: Json
          updated_at?: string
          usuario_atualizacao?: string | null
        }
        Update: {
          ativo?: boolean
          campos?: Json
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          secoes?: Json
          updated_at?: string
          usuario_atualizacao?: string | null
        }
        Relationships: []
      }
      dados_extraidos: {
        Row: {
          campo: string
          confianca: string | null
          confirmado: boolean
          created_at: string
          data_edicao: string | null
          documento_id: string | null
          editado_manual: boolean
          evidencia_id: string | null
          extraido_por: string | null
          id: string
          ocorrencia_id: string | null
          processo_id: string | null
          tipo_dado: string | null
          usuario_edicao: string | null
          valor: string | null
          valor_original: string | null
        }
        Insert: {
          campo: string
          confianca?: string | null
          confirmado?: boolean
          created_at?: string
          data_edicao?: string | null
          documento_id?: string | null
          editado_manual?: boolean
          evidencia_id?: string | null
          extraido_por?: string | null
          id?: string
          ocorrencia_id?: string | null
          processo_id?: string | null
          tipo_dado?: string | null
          usuario_edicao?: string | null
          valor?: string | null
          valor_original?: string | null
        }
        Update: {
          campo?: string
          confianca?: string | null
          confirmado?: boolean
          created_at?: string
          data_edicao?: string | null
          documento_id?: string | null
          editado_manual?: boolean
          evidencia_id?: string | null
          extraido_por?: string | null
          id?: string
          ocorrencia_id?: string | null
          processo_id?: string | null
          tipo_dado?: string | null
          usuario_edicao?: string | null
          valor?: string | null
          valor_original?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dados_extraidos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dados_extraidos_evidencia_id_fkey"
            columns: ["evidencia_id"]
            isOneToOne: false
            referencedRelation: "evidencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dados_extraidos_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dados_extraidos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          caminho_arquivo: string | null
          categoria: string
          data_processamento: string | null
          data_upload: string
          duracao_ms: number | null
          erro_processamento: string | null
          extensao: string | null
          hash_documento: string | null
          id: string
          motor: string
          motor_versao: string | null
          nome_armazenado: string
          nome_original: string
          paginas_json: Json | null
          quantidade_paginas: number | null
          status_processamento: string
          tamanho: number | null
          texto_extraido: string | null
          tipo_arquivo: string | null
          usuario_upload: string | null
        }
        Insert: {
          caminho_arquivo?: string | null
          categoria?: string
          data_processamento?: string | null
          data_upload?: string
          duracao_ms?: number | null
          erro_processamento?: string | null
          extensao?: string | null
          hash_documento?: string | null
          id?: string
          motor?: string
          motor_versao?: string | null
          nome_armazenado: string
          nome_original: string
          paginas_json?: Json | null
          quantidade_paginas?: number | null
          status_processamento?: string
          tamanho?: number | null
          texto_extraido?: string | null
          tipo_arquivo?: string | null
          usuario_upload?: string | null
        }
        Update: {
          caminho_arquivo?: string | null
          categoria?: string
          data_processamento?: string | null
          data_upload?: string
          duracao_ms?: number | null
          erro_processamento?: string | null
          extensao?: string | null
          hash_documento?: string | null
          id?: string
          motor?: string
          motor_versao?: string | null
          nome_armazenado?: string
          nome_original?: string
          paginas_json?: Json | null
          quantidade_paginas?: number | null
          status_processamento?: string
          tamanho?: number | null
          texto_extraido?: string | null
          tipo_arquivo?: string | null
          usuario_upload?: string | null
        }
        Relationships: []
      }
      enquadramentos: {
        Row: {
          alinea: string | null
          artigo: string | null
          created_at: string
          data_validacao: string | null
          dispositivo_texto: string | null
          id: string
          inciso: string | null
          item_edital: string | null
          justificativa: string | null
          lei: string | null
          ocorrencia_id: string | null
          origem_dispositivo: string | null
          paragrafo: string | null
          status_validacao: string | null
          subitem_edital: string | null
          usuario_validacao: string | null
        }
        Insert: {
          alinea?: string | null
          artigo?: string | null
          created_at?: string
          data_validacao?: string | null
          dispositivo_texto?: string | null
          id?: string
          inciso?: string | null
          item_edital?: string | null
          justificativa?: string | null
          lei?: string | null
          ocorrencia_id?: string | null
          origem_dispositivo?: string | null
          paragrafo?: string | null
          status_validacao?: string | null
          subitem_edital?: string | null
          usuario_validacao?: string | null
        }
        Update: {
          alinea?: string | null
          artigo?: string | null
          created_at?: string
          data_validacao?: string | null
          dispositivo_texto?: string | null
          id?: string
          inciso?: string | null
          item_edital?: string | null
          justificativa?: string | null
          lei?: string | null
          ocorrencia_id?: string | null
          origem_dispositivo?: string | null
          paragrafo?: string | null
          status_validacao?: string | null
          subitem_edital?: string | null
          usuario_validacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enquadramentos_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_ocorrencia: {
        Row: {
          autor: string | null
          cnpj_destinatario: string | null
          created_at: string
          data_evento: string | null
          destinatario: string | null
          evidencia_id: string | null
          hora_evento: string | null
          id: string
          licitante_id: string | null
          mensagem_normalizada: string | null
          mensagem_original: string | null
          nivel_confianca: string | null
          ocorrencia_id: string | null
          ordem_cronologica: number | null
          pagina_documento: number | null
          tipo_evento: string | null
        }
        Insert: {
          autor?: string | null
          cnpj_destinatario?: string | null
          created_at?: string
          data_evento?: string | null
          destinatario?: string | null
          evidencia_id?: string | null
          hora_evento?: string | null
          id?: string
          licitante_id?: string | null
          mensagem_normalizada?: string | null
          mensagem_original?: string | null
          nivel_confianca?: string | null
          ocorrencia_id?: string | null
          ordem_cronologica?: number | null
          pagina_documento?: number | null
          tipo_evento?: string | null
        }
        Update: {
          autor?: string | null
          cnpj_destinatario?: string | null
          created_at?: string
          data_evento?: string | null
          destinatario?: string | null
          evidencia_id?: string | null
          hora_evento?: string | null
          id?: string
          licitante_id?: string | null
          mensagem_normalizada?: string | null
          mensagem_original?: string | null
          nivel_confianca?: string | null
          ocorrencia_id?: string | null
          ordem_cronologica?: number | null
          pagina_documento?: number | null
          tipo_evento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_ocorrencia_evidencia_id_fkey"
            columns: ["evidencia_id"]
            isOneToOne: false
            referencedRelation: "evidencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_ocorrencia_licitante_id_fkey"
            columns: ["licitante_id"]
            isOneToOne: false
            referencedRelation: "licitantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_ocorrencia_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias"
            referencedColumns: ["id"]
          },
        ]
      }
      evidencias: {
        Row: {
          created_at: string
          data_evento: string | null
          documento_id: string | null
          entidade_relacionada: string | null
          fim_texto: number | null
          hash_evidencia: string | null
          hora_evento: string | null
          id: string
          inicio_texto: number | null
          pagina: number | null
          texto_original: string | null
          tipo_evidencia: string | null
        }
        Insert: {
          created_at?: string
          data_evento?: string | null
          documento_id?: string | null
          entidade_relacionada?: string | null
          fim_texto?: number | null
          hash_evidencia?: string | null
          hora_evento?: string | null
          id?: string
          inicio_texto?: number | null
          pagina?: number | null
          texto_original?: string | null
          tipo_evidencia?: string | null
        }
        Update: {
          created_at?: string
          data_evento?: string | null
          documento_id?: string | null
          entidade_relacionada?: string | null
          fim_texto?: number | null
          hash_evidencia?: string | null
          hora_evento?: string | null
          id?: string
          inicio_texto?: number | null
          pagina?: number | null
          texto_original?: string | null
          tipo_evidencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidencias_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      licitantes: {
        Row: {
          cnpj_cpf: string | null
          cpf_representante: string | null
          created_at: string
          email: string | null
          endereco: string | null
          grupo_lote: string | null
          id: string
          itens: string | null
          nivel_confianca: string | null
          nome_fantasia: string | null
          origem_dado: string | null
          processo_id: string | null
          razao_social: string | null
          representante: string | null
          situacao: string | null
          telefone: string | null
          valor_final: string | null
          valor_ofertado: string | null
        }
        Insert: {
          cnpj_cpf?: string | null
          cpf_representante?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          grupo_lote?: string | null
          id?: string
          itens?: string | null
          nivel_confianca?: string | null
          nome_fantasia?: string | null
          origem_dado?: string | null
          processo_id?: string | null
          razao_social?: string | null
          representante?: string | null
          situacao?: string | null
          telefone?: string | null
          valor_final?: string | null
          valor_ofertado?: string | null
        }
        Update: {
          cnpj_cpf?: string | null
          cpf_representante?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          grupo_lote?: string | null
          id?: string
          itens?: string | null
          nivel_confianca?: string | null
          nome_fantasia?: string | null
          origem_dado?: string | null
          processo_id?: string | null
          razao_social?: string | null
          representante?: string | null
          situacao?: string | null
          telefone?: string | null
          valor_final?: string | null
          valor_ofertado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licitantes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          data_validacao: string | null
          decisao: string | null
          descricao_resumida: string | null
          diligencia: string | null
          documentos_apresentados: string | null
          documentos_nao_apresentados: string | null
          documentos_solicitados: string | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          justificativa: string | null
          licitante_id: string | null
          manifestacao: string | null
          nivel_confianca: string | null
          novo_prazo: string | null
          pedido_prorrogacao: string | null
          prazo_diligencia: string | null
          prazo_justificativa: string | null
          prazo_original: string | null
          prazo_prorrogado: string | null
          prejuizo_mensuravel: string | null
          processo_id: string | null
          prorrogacao_concedida: string | null
          providencias: string | null
          repercussao: string | null
          resposta_justificativa: string | null
          status: string
          tipo_ocorrencia: string | null
          tipos_adicionais: string[] | null
          usuario_validacao: string | null
          validada: boolean
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          data_validacao?: string | null
          decisao?: string | null
          descricao_resumida?: string | null
          diligencia?: string | null
          documentos_apresentados?: string | null
          documentos_nao_apresentados?: string | null
          documentos_solicitados?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          justificativa?: string | null
          licitante_id?: string | null
          manifestacao?: string | null
          nivel_confianca?: string | null
          novo_prazo?: string | null
          pedido_prorrogacao?: string | null
          prazo_diligencia?: string | null
          prazo_justificativa?: string | null
          prazo_original?: string | null
          prazo_prorrogado?: string | null
          prejuizo_mensuravel?: string | null
          processo_id?: string | null
          prorrogacao_concedida?: string | null
          providencias?: string | null
          repercussao?: string | null
          resposta_justificativa?: string | null
          status?: string
          tipo_ocorrencia?: string | null
          tipos_adicionais?: string[] | null
          usuario_validacao?: string | null
          validada?: boolean
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          data_validacao?: string | null
          decisao?: string | null
          descricao_resumida?: string | null
          diligencia?: string | null
          documentos_apresentados?: string | null
          documentos_nao_apresentados?: string | null
          documentos_solicitados?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          justificativa?: string | null
          licitante_id?: string | null
          manifestacao?: string | null
          nivel_confianca?: string | null
          novo_prazo?: string | null
          pedido_prorrogacao?: string | null
          prazo_diligencia?: string | null
          prazo_justificativa?: string | null
          prazo_original?: string | null
          prazo_prorrogado?: string | null
          prejuizo_mensuravel?: string | null
          processo_id?: string | null
          prorrogacao_concedida?: string | null
          providencias?: string | null
          repercussao?: string | null
          resposta_justificativa?: string | null
          status?: string
          tipo_ocorrencia?: string | null
          tipos_adicionais?: string[] | null
          usuario_validacao?: string | null
          validada?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_licitante_id_fkey"
            columns: ["licitante_id"]
            isOneToOne: false
            referencedRelation: "licitantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      painel_importacoes: {
        Row: {
          atual: boolean
          created_at: string
          documento_id: string | null
          duracao_ms: number | null
          id: string
          identificacao_processo: string | null
          motor: string
          motor_versao: string | null
          nome_documento: string | null
          processo_id: string | null
          total_itens: number
          usuario: string | null
          valor_total: number | null
          versao: number
        }
        Insert: {
          atual?: boolean
          created_at?: string
          documento_id?: string | null
          duracao_ms?: number | null
          id?: string
          identificacao_processo?: string | null
          motor?: string
          motor_versao?: string | null
          nome_documento?: string | null
          processo_id?: string | null
          total_itens?: number
          usuario?: string | null
          valor_total?: number | null
          versao?: number
        }
        Update: {
          atual?: boolean
          created_at?: string
          documento_id?: string | null
          duracao_ms?: number | null
          id?: string
          identificacao_processo?: string | null
          motor?: string
          motor_versao?: string | null
          nome_documento?: string | null
          processo_id?: string | null
          total_itens?: number
          usuario?: string | null
          valor_total?: number | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "painel_importacoes_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "painel_importacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      painel_itens: {
        Row: {
          cnpj: string | null
          created_at: string
          diferenca: number | null
          documento_id: string | null
          especificacao: string | null
          id: string
          importacao_id: string
          licitante: string | null
          numero_item: number | null
          observacoes: string | null
          origem_valor: string | null
          pagina: number | null
          percentual_diferenca: number | null
          processo_id: string | null
          quantidade: number | null
          situacao: string | null
          status_conferencia: string
          trecho_origem: string | null
          unidade: string | null
          validacao_total: string | null
          valor_negociado_total: number | null
          valor_negociado_unitario: number | null
          valor_referencia_total: number | null
          valor_referencia_unitario: number | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          diferenca?: number | null
          documento_id?: string | null
          especificacao?: string | null
          id?: string
          importacao_id: string
          licitante?: string | null
          numero_item?: number | null
          observacoes?: string | null
          origem_valor?: string | null
          pagina?: number | null
          percentual_diferenca?: number | null
          processo_id?: string | null
          quantidade?: number | null
          situacao?: string | null
          status_conferencia?: string
          trecho_origem?: string | null
          unidade?: string | null
          validacao_total?: string | null
          valor_negociado_total?: number | null
          valor_negociado_unitario?: number | null
          valor_referencia_total?: number | null
          valor_referencia_unitario?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          diferenca?: number | null
          documento_id?: string | null
          especificacao?: string | null
          id?: string
          importacao_id?: string
          licitante?: string | null
          numero_item?: number | null
          observacoes?: string | null
          origem_valor?: string | null
          pagina?: number | null
          percentual_diferenca?: number | null
          processo_id?: string | null
          quantidade?: number | null
          situacao?: string | null
          status_conferencia?: string
          trecho_origem?: string | null
          unidade?: string | null
          validacao_total?: string | null
          valor_negociado_total?: number | null
          valor_negociado_unitario?: number | null
          valor_referencia_total?: number | null
          valor_referencia_unitario?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "painel_itens_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "painel_itens_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "painel_importacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "painel_itens_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos: {
        Row: {
          agente: string | null
          ano_certame: string | null
          created_at: string
          data_sessao: string | null
          data_validacao: string | null
          documento_id: string | null
          horario_sessao: string | null
          id: string
          identificacao_completa: string | null
          modalidade: string | null
          nivel_confianca: string | null
          numero_certame: string | null
          numero_processo: string | null
          objeto: string | null
          orgao: string | null
          plataforma: string | null
          processo_sei: string | null
          secretaria_demandante: string | null
          uasg: string | null
          usuario_validacao: string | null
          validado: boolean
        }
        Insert: {
          agente?: string | null
          ano_certame?: string | null
          created_at?: string
          data_sessao?: string | null
          data_validacao?: string | null
          documento_id?: string | null
          horario_sessao?: string | null
          id?: string
          identificacao_completa?: string | null
          modalidade?: string | null
          nivel_confianca?: string | null
          numero_certame?: string | null
          numero_processo?: string | null
          objeto?: string | null
          orgao?: string | null
          plataforma?: string | null
          processo_sei?: string | null
          secretaria_demandante?: string | null
          uasg?: string | null
          usuario_validacao?: string | null
          validado?: boolean
        }
        Update: {
          agente?: string | null
          ano_certame?: string | null
          created_at?: string
          data_sessao?: string | null
          data_validacao?: string | null
          documento_id?: string | null
          horario_sessao?: string | null
          id?: string
          identificacao_completa?: string | null
          modalidade?: string | null
          nivel_confianca?: string | null
          numero_certame?: string | null
          numero_processo?: string | null
          objeto?: string | null
          orgao?: string | null
          plataforma?: string | null
          processo_sei?: string | null
          secretaria_demandante?: string | null
          uasg?: string | null
          usuario_validacao?: string | null
          validado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "processos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          cargo: string | null
          created_at: string
          email: string | null
          id: string
          matricula: string | null
          nome: string
          orgao: string | null
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          email?: string | null
          id: string
          matricula?: string | null
          nome?: string
          orgao?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          matricula?: string | null
          nome?: string
          orgao?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      relatorio_numeracao: {
        Row: {
          ano: string
          created_at: string
          ultimo_numero: number
          updated_at: string
        }
        Insert: {
          ano: string
          created_at?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Update: {
          ano?: string
          created_at?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Relationships: []
      }
      relatorio_versoes: {
        Row: {
          arquivo_pdf: string | null
          arquivo_word: string | null
          conteudo_json: Json
          data_criacao: string
          id: string
          motivo_alteracao: string | null
          numero_versao: number
          relatorio_id: string | null
          rotulo: string | null
          usuario: string | null
        }
        Insert: {
          arquivo_pdf?: string | null
          arquivo_word?: string | null
          conteudo_json?: Json
          data_criacao?: string
          id?: string
          motivo_alteracao?: string | null
          numero_versao: number
          relatorio_id?: string | null
          rotulo?: string | null
          usuario?: string | null
        }
        Update: {
          arquivo_pdf?: string | null
          arquivo_word?: string | null
          conteudo_json?: Json
          data_criacao?: string
          id?: string
          motivo_alteracao?: string | null
          numero_versao?: number
          relatorio_id?: string | null
          rotulo?: string | null
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_versoes_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios: {
        Row: {
          ano: string | null
          arquivo_pdf: string | null
          arquivo_word: string | null
          checklist: Json
          created_at: string
          dados_json: Json
          data_relatorio: string | null
          data_validacao: string | null
          documentos_comprobatorios: string[] | null
          enquadramento: string | null
          hash_arquivo: string | null
          id: string
          numero_relatorio: string | null
          ocorrencia_id: string | null
          processo_id: string | null
          processo_sei: string | null
          providencias: string | null
          relato: string | null
          repercussao: string | null
          status: string
          updated_at: string
          usuario_criacao: string | null
          usuario_validacao: string | null
          versao: number
        }
        Insert: {
          ano?: string | null
          arquivo_pdf?: string | null
          arquivo_word?: string | null
          checklist?: Json
          created_at?: string
          dados_json?: Json
          data_relatorio?: string | null
          data_validacao?: string | null
          documentos_comprobatorios?: string[] | null
          enquadramento?: string | null
          hash_arquivo?: string | null
          id?: string
          numero_relatorio?: string | null
          ocorrencia_id?: string | null
          processo_id?: string | null
          processo_sei?: string | null
          providencias?: string | null
          relato?: string | null
          repercussao?: string | null
          status?: string
          updated_at?: string
          usuario_criacao?: string | null
          usuario_validacao?: string | null
          versao?: number
        }
        Update: {
          ano?: string | null
          arquivo_pdf?: string | null
          arquivo_word?: string | null
          checklist?: Json
          created_at?: string
          dados_json?: Json
          data_relatorio?: string | null
          data_validacao?: string | null
          documentos_comprobatorios?: string[] | null
          enquadramento?: string | null
          hash_arquivo?: string | null
          id?: string
          numero_relatorio?: string | null
          ocorrencia_id?: string | null
          processo_id?: string | null
          processo_sei?: string | null
          providencias?: string | null
          relato?: string | null
          repercussao?: string | null
          status?: string
          updated_at?: string
          usuario_criacao?: string | null
          usuario_validacao?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "ocorrencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      proximo_numero_relatorio: { Args: { _ano: string }; Returns: number }
    }
    Enums: {
      app_role: "ADMIN" | "ANALISTA" | "REVISOR" | "CONSULTA"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["ADMIN", "ANALISTA", "REVISOR", "CONSULTA"],
    },
  },
} as const

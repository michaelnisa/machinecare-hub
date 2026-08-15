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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      calibration_logs: {
        Row: {
          calibrated_by: string | null
          calibrated_on: string
          certificate_url: string | null
          created_at: string
          created_by: string | null
          id: string
          next_due: string | null
          notes: string | null
          organisation_id: string
          tool_id: string
        }
        Insert: {
          calibrated_by?: string | null
          calibrated_on?: string
          certificate_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          next_due?: string | null
          notes?: string | null
          organisation_id: string
          tool_id: string
        }
        Update: {
          calibrated_by?: string | null
          calibrated_on?: string
          certificate_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          next_due?: string | null
          notes?: string | null
          organisation_id?: string
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calibration_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calibration_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calibration_logs_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "controlled_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_completions: {
        Row: {
          checklist_item_id: string
          completed_at: string
          completed_by: string | null
          completed_by_name: string | null
          hours_at_completion: number | null
          id: string
          machine_id: string
          notes: string | null
          service_log_id: string | null
        }
        Insert: {
          checklist_item_id: string
          completed_at?: string
          completed_by?: string | null
          completed_by_name?: string | null
          hours_at_completion?: number | null
          id?: string
          machine_id: string
          notes?: string | null
          service_log_id?: string | null
        }
        Update: {
          checklist_item_id?: string
          completed_at?: string
          completed_by?: string | null
          completed_by_name?: string | null
          hours_at_completion?: number | null
          id?: string
          machine_id?: string
          notes?: string | null
          service_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_completions_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "machine_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_service_log_id_fkey"
            columns: ["service_log_id"]
            isOneToOne: false
            referencedRelation: "service_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_execution_responses: {
        Row: {
          created_at: string
          execution_id: string
          id: string
          item_id: string | null
          item_text_snapshot: string
          item_type: string
          measured_value: number | null
          notes: string | null
          photo_url: string | null
          result: string | null
          severity_snapshot: string
          sort_order: number
          text_response: string | null
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          execution_id: string
          id?: string
          item_id?: string | null
          item_text_snapshot: string
          item_type?: string
          measured_value?: number | null
          notes?: string | null
          photo_url?: string | null
          result?: string | null
          severity_snapshot?: string
          sort_order?: number
          text_response?: string | null
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          execution_id?: string
          id?: string
          item_id?: string | null
          item_text_snapshot?: string
          item_type?: string
          measured_value?: number | null
          notes?: string | null
          photo_url?: string | null
          result?: string | null
          severity_snapshot?: string
          sort_order?: number
          text_response?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_execution_responses_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "checklist_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_execution_responses_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_execution_responses_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_executions: {
        Row: {
          created_at: string
          driver_id: string | null
          hours_at_execution: number | null
          id: string
          machine_id: string
          notes: string | null
          organisation_id: string
          overall_result: string | null
          performed_at: string
          performed_by: string | null
          performed_by_name: string | null
          status: string
          template_id: string
          template_version: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          hours_at_execution?: number | null
          id?: string
          machine_id: string
          notes?: string | null
          organisation_id: string
          overall_result?: string | null
          performed_at?: string
          performed_by?: string | null
          performed_by_name?: string | null
          status?: string
          template_id: string
          template_version?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          hours_at_execution?: number | null
          id?: string
          machine_id?: string
          notes?: string | null
          organisation_id?: string
          overall_result?: string | null
          performed_at?: string
          performed_by?: string | null
          performed_by_name?: string | null
          status?: string
          template_id?: string
          template_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_executions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_executions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_executions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_executions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_executions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          created_at: string
          id: string
          item_type: string
          max_value: number | null
          min_value: number | null
          severity: string
          sort_order: number
          template_id: string
          text: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_type?: string
          max_value?: number | null
          min_value?: number | null
          severity?: string
          sort_order?: number
          template_id: string
          text: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_type?: string
          max_value?: number | null
          min_value?: number | null
          severity?: string
          sort_order?: number
          template_id?: string
          text?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_fleet_pre_start: boolean
          machine_category: string | null
          machine_id: string | null
          name: string
          organisation_id: string
          parent_template_id: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_fleet_pre_start?: boolean
          machine_category?: string | null
          machine_id?: string | null
          name: string
          organisation_id: string
          parent_template_id?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_fleet_pre_start?: boolean
          machine_category?: string | null
          machine_id?: string | null
          name?: string
          organisation_id?: string
          parent_template_id?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_parent_template_id_fkey"
            columns: ["parent_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_documents: {
        Row: {
          contractor_id: string
          created_at: string
          doc_type: string
          expires_on: string | null
          file_url: string | null
          id: string
          issued_on: string | null
          name: string
          organisation_id: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          doc_type?: string
          expires_on?: string | null
          file_url?: string | null
          id?: string
          issued_on?: string | null
          name: string
          organisation_id: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          doc_type?: string
          expires_on?: string | null
          file_url?: string | null
          id?: string
          issued_on?: string | null
          name?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_documents_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_documents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_workers: {
        Row: {
          contractor_id: string
          created_at: string
          full_name: string
          id: string
          id_number: string | null
          inductee_id: string | null
          is_active: boolean
          organisation_id: string
          phone: string | null
          role_title: string | null
        }
        Insert: {
          contractor_id: string
          created_at?: string
          full_name: string
          id?: string
          id_number?: string | null
          inductee_id?: string | null
          is_active?: boolean
          organisation_id: string
          phone?: string | null
          role_title?: string | null
        }
        Update: {
          contractor_id?: string
          created_at?: string
          full_name?: string
          id?: string
          id_number?: string | null
          inductee_id?: string | null
          is_active?: boolean
          organisation_id?: string
          phone?: string | null
          role_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_workers_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_workers_inductee_id_fkey"
            columns: ["inductee_id"]
            isOneToOne: false
            referencedRelation: "inductees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_workers_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          insurance_doc_url: string | null
          insurance_expiry: string | null
          notes: string | null
          organisation_id: string
          status: string
        }
        Insert: {
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          insurance_doc_url?: string | null
          insurance_expiry?: string | null
          notes?: string | null
          organisation_id: string
          status?: string
        }
        Update: {
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          insurance_doc_url?: string | null
          insurance_expiry?: string | null
          notes?: string | null
          organisation_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractors_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      controlled_tool_requests: {
        Row: {
          acknowledged_at: string | null
          condition_on_return: string | null
          created_at: string
          id: string
          issued_at: string | null
          issued_by: string | null
          organisation_id: string
          requested_by: string | null
          returned_at: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tool_id: string
          work_order_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          condition_on_return?: string | null
          created_at?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          organisation_id: string
          requested_by?: string | null
          returned_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tool_id: string
          work_order_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          condition_on_return?: string | null
          created_at?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          organisation_id?: string
          requested_by?: string | null
          returned_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tool_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controlled_tool_requests_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_tool_requests_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_tool_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_tool_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_tool_requests_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "controlled_tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_tool_requests_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      controlled_tools: {
        Row: {
          asset_tag: string | null
          assigned_to: string | null
          calibration_due_date: string | null
          condition: string
          created_at: string
          created_by: string | null
          id: string
          last_calibration_date: string | null
          location: string | null
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          organisation_id: string
          requires_certification: string | null
          requires_safety_approval: boolean
          serial_number: string | null
          status: string
          tool_type: string
        }
        Insert: {
          asset_tag?: string | null
          assigned_to?: string | null
          calibration_due_date?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_calibration_date?: string | null
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          organisation_id: string
          requires_certification?: string | null
          requires_safety_approval?: boolean
          serial_number?: string | null
          status?: string
          tool_type?: string
        }
        Update: {
          asset_tag?: string | null
          assigned_to?: string | null
          calibration_due_date?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_calibration_date?: string | null
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          organisation_id?: string
          requires_certification?: string | null
          requires_safety_approval?: boolean
          serial_number?: string | null
          status?: string
          tool_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "controlled_tools_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_tools_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controlled_tools_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      corrective_actions: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          department: string | null
          description: string
          due_date: string | null
          evidence_note: string | null
          id: string
          organisation_id: string
          priority: string
          responsible_person: string | null
          source_id: string | null
          source_type: string
          status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description: string
          due_date?: string | null
          evidence_note?: string | null
          id?: string
          organisation_id: string
          priority?: string
          responsible_person?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string
          due_date?: string | null
          evidence_note?: string | null
          id?: string
          organisation_id?: string
          priority?: string
          responsible_person?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_responsible_person_fkey"
            columns: ["responsible_person"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          doc_category: string | null
          expires_on: string | null
          file_type: string | null
          file_url: string
          id: string
          issued_on: string | null
          issuer: string | null
          machine_id: string
          name: string
          reminder_days: number
          service_log_id: string | null
          uploaded_at: string
        }
        Insert: {
          doc_category?: string | null
          expires_on?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          issued_on?: string | null
          issuer?: string | null
          machine_id: string
          name: string
          reminder_days?: number
          service_log_id?: string | null
          uploaded_at?: string
        }
        Update: {
          doc_category?: string | null
          expires_on?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          issued_on?: string | null
          issuer?: string | null
          machine_id?: string
          name?: string
          reminder_days?: number
          service_log_id?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_service_log_id_fkey"
            columns: ["service_log_id"]
            isOneToOne: false
            referencedRelation: "service_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          licence_class: string | null
          licence_expiry: string | null
          licence_number: string | null
          medical_expiry: string | null
          notes: string | null
          organisation_id: string
          phone: string | null
          photo_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          licence_class?: string | null
          licence_expiry?: string | null
          licence_number?: string | null
          medical_expiry?: string | null
          notes?: string | null
          organisation_id: string
          phone?: string | null
          photo_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          licence_class?: string | null
          licence_expiry?: string | null
          licence_number?: string | null
          medical_expiry?: string | null
          notes?: string | null
          organisation_id?: string
          phone?: string | null
          photo_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      employee_competencies: {
        Row: {
          certificate_number: string | null
          competency_name: string
          created_at: string
          doc_url: string | null
          employee_id: string
          expiry_date: string | null
          id: string
          issued_by: string | null
          issued_on: string | null
          organisation_id: string
          status: string
        }
        Insert: {
          certificate_number?: string | null
          competency_name: string
          created_at?: string
          doc_url?: string | null
          employee_id: string
          expiry_date?: string | null
          id?: string
          issued_by?: string | null
          issued_on?: string | null
          organisation_id: string
          status?: string
        }
        Update: {
          certificate_number?: string | null
          competency_name?: string
          created_at?: string
          doc_url?: string | null
          employee_id?: string
          expiry_date?: string | null
          id?: string
          issued_by?: string | null
          issued_on?: string | null
          organisation_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_competencies_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_competencies_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_competencies_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      fault_reports: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          dismiss_reason: string | null
          duplicate_of: string | null
          id: string
          machine_id: string
          organisation_id: string
          photo_url: string | null
          reporter_name: string
          reporter_phone: string
          severity: string
          source_execution_id: string | null
          status: string
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          dismiss_reason?: string | null
          duplicate_of?: string | null
          id?: string
          machine_id: string
          organisation_id: string
          photo_url?: string | null
          reporter_name: string
          reporter_phone: string
          severity?: string
          source_execution_id?: string | null
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          dismiss_reason?: string | null
          duplicate_of?: string | null
          id?: string
          machine_id?: string
          organisation_id?: string
          photo_url?: string | null
          reporter_name?: string
          reporter_phone?: string
          severity?: string
          source_execution_id?: string | null
          status?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fault_reports_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "fault_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fault_reports_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fault_reports_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fault_reports_source_execution_id_fkey"
            columns: ["source_execution_id"]
            isOneToOne: false
            referencedRelation: "checklist_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fault_reports_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_logs: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string | null
          fuel_cost: number
          fuel_litres: number | null
          id: string
          machine_id: string
          notes: string | null
          odometer: number | null
          recorded_at: string
          station: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          fuel_cost?: number
          fuel_litres?: number | null
          id?: string
          machine_id: string
          notes?: string | null
          odometer?: number | null
          recorded_at?: string
          station?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          fuel_cost?: number
          fuel_litres?: number | null
          id?: string
          machine_id?: string
          notes?: string | null
          odometer?: number | null
          recorded_at?: string
          station?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_appointments: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          duration_minutes: number
          id: string
          job_id: string | null
          mechanic_id: string | null
          notes: string | null
          organisation_id: string
          purpose: string | null
          scheduled_at: string
          status: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          duration_minutes?: number
          id?: string
          job_id?: string | null
          mechanic_id?: string | null
          notes?: string | null
          organisation_id: string
          purpose?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          duration_minutes?: number
          id?: string
          job_id?: string | null
          mechanic_id?: string | null
          notes?: string | null
          organisation_id?: string
          purpose?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "garage_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_appointments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_appointments_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "garage_mechanics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_appointments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_appointments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "garage_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_customer_messages: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          job_id: string | null
          message_body: string
          organisation_id: string
          sent_at: string
          status: string
          trigger_event: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          job_id?: string | null
          message_body: string
          organisation_id: string
          sent_at?: string
          status?: string
          trigger_event?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          job_id?: string | null
          message_body?: string
          organisation_id?: string
          sent_at?: string
          status?: string
          trigger_event?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_customer_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_customer_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "garage_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_customer_messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_customer_messages_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_customers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organisation_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organisation_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organisation_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_customers_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_estimate_items: {
        Row: {
          created_at: string
          description: string
          estimate_id: string
          id: string
          item_id: string | null
          line_total: number | null
          quantity: number
          unit_cost: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          estimate_id: string
          id?: string
          item_id?: string | null
          line_total?: number | null
          quantity?: number
          unit_cost?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          estimate_id?: string
          id?: string
          item_id?: string | null
          line_total?: number | null
          quantity?: number
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "garage_estimate_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "garage_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_estimate_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_estimates: {
        Row: {
          approval_method: string | null
          approved_amount: number | null
          approved_at: string | null
          approved_by_name: string | null
          approved_by_profile: string | null
          created_at: string
          created_by: string | null
          decline_reason: string | null
          discount: number
          id: string
          job_id: string
          labour_cost: number
          notes: string | null
          organisation_id: string
          other_cost: number
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approval_method?: string | null
          approved_amount?: number | null
          approved_at?: string | null
          approved_by_name?: string | null
          approved_by_profile?: string | null
          created_at?: string
          created_by?: string | null
          decline_reason?: string | null
          discount?: number
          id?: string
          job_id: string
          labour_cost?: number
          notes?: string | null
          organisation_id: string
          other_cost?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approval_method?: string | null
          approved_amount?: number | null
          approved_at?: string | null
          approved_by_name?: string | null
          approved_by_profile?: string | null
          created_at?: string
          created_by?: string | null
          decline_reason?: string | null
          discount?: number
          id?: string
          job_id?: string
          labour_cost?: number
          notes?: string | null
          organisation_id?: string
          other_cost?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_estimates_approved_by_profile_fkey"
            columns: ["approved_by_profile"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_estimates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_estimates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_estimates_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          item_id: string | null
          line_total: number | null
          quantity: number
          unit_cost: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          item_id?: string | null
          line_total?: number | null
          quantity?: number
          unit_cost?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          item_id?: string | null
          line_total?: number | null
          quantity?: number
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "garage_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "garage_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_invoice_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          discount: number
          estimate_id: string | null
          id: string
          invoice_number: number | null
          invoice_year: number | null
          issued_at: string
          job_id: string
          labour_cost: number
          notes: string | null
          organisation_id: string
          other_cost: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount?: number
          estimate_id?: string | null
          id?: string
          invoice_number?: number | null
          invoice_year?: number | null
          issued_at?: string
          job_id: string
          labour_cost?: number
          notes?: string | null
          organisation_id: string
          other_cost?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount?: number
          estimate_id?: string | null
          id?: string
          invoice_number?: number | null
          invoice_year?: number | null
          issued_at?: string
          job_id?: string
          labour_cost?: number
          notes?: string | null
          organisation_id?: string
          other_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "garage_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_invoices_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "garage_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_invoices_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_job_findings: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          job_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          job_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_job_findings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_job_findings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_job_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          job_id: string
          note: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          job_id: string
          note?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          job_id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_job_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_job_status_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "garage_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_jobs: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          delivered_at: string | null
          diagnosis_notes: string | null
          expected_completion: string | null
          id: string
          job_number: number | null
          job_year: number | null
          mechanic_id: string | null
          mileage_at_intake: number | null
          notes: string | null
          organisation_id: string
          priority: string
          ready_at: string | null
          recommended_repair: string | null
          reported_problem: string
          started_at: string | null
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          delivered_at?: string | null
          diagnosis_notes?: string | null
          expected_completion?: string | null
          id?: string
          job_number?: number | null
          job_year?: number | null
          mechanic_id?: string | null
          mileage_at_intake?: number | null
          notes?: string | null
          organisation_id: string
          priority?: string
          ready_at?: string | null
          recommended_repair?: string | null
          reported_problem: string
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delivered_at?: string | null
          diagnosis_notes?: string | null
          expected_completion?: string | null
          id?: string
          job_number?: number | null
          job_year?: number | null
          mechanic_id?: string | null
          mileage_at_intake?: number | null
          notes?: string | null
          organisation_id?: string
          priority?: string
          ready_at?: string | null
          recommended_repair?: string | null
          reported_problem?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "garage_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_jobs_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "garage_mechanics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_jobs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_jobs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "garage_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_mechanics: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          organisation_id: string
          phone: string | null
          specialization: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          organisation_id: string
          phone?: string | null
          specialization?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          organisation_id?: string
          phone?: string | null
          specialization?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_mechanics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_mechanics_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string
          notes: string | null
          organisation_id: string
          paid_at: string
          received_by: string | null
          reference: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string
          notes?: string | null
          organisation_id: string
          paid_at?: string
          received_by?: string | null
          reference?: string | null
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          notes?: string | null
          organisation_id?: string
          paid_at?: string
          received_by?: string | null
          reference?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "garage_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_payments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_vehicles: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          engine: string | null
          fuel_type: string | null
          id: string
          make: string | null
          mileage: number
          model: string | null
          next_service_date: string | null
          next_service_mileage: number | null
          notes: string | null
          organisation_id: string
          photo_url: string | null
          registration_number: string | null
          status: string
          transmission: string | null
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          engine?: string | null
          fuel_type?: string | null
          id?: string
          make?: string | null
          mileage?: number
          model?: string | null
          next_service_date?: string | null
          next_service_mileage?: number | null
          notes?: string | null
          organisation_id: string
          photo_url?: string | null
          registration_number?: string | null
          status?: string
          transmission?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          engine?: string | null
          fuel_type?: string | null
          id?: string
          make?: string | null
          mileage?: number
          model?: string | null
          next_service_date?: string | null
          next_service_mileage?: number | null
          notes?: string | null
          organisation_id?: string
          photo_url?: string | null
          registration_number?: string | null
          status?: string
          transmission?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_vehicles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "garage_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_vehicles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          goods_receipt_id: string
          id: string
          po_item_id: string
          quantity_accepted: number
          quantity_received: number
          quantity_rejected: number
          quarantine_status: string | null
          quarantined: boolean
          rejection_reason: string | null
        }
        Insert: {
          goods_receipt_id: string
          id?: string
          po_item_id: string
          quantity_accepted: number
          quantity_received: number
          quantity_rejected?: number
          quarantine_status?: string | null
          quarantined?: boolean
          rejection_reason?: string | null
        }
        Update: {
          goods_receipt_id?: string
          id?: string
          po_item_id?: string
          quantity_accepted?: number
          quantity_received?: number
          quantity_rejected?: number
          quarantine_status?: string | null
          quarantined?: boolean
          rejection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          id: string
          location_id: string
          notes: string | null
          organisation_id: string
          purchase_order_id: string
          received_at: string
          received_by: string | null
        }
        Insert: {
          id?: string
          location_id: string
          notes?: string | null
          organisation_id: string
          purchase_order_id: string
          received_at?: string
          received_by?: string | null
        }
        Update: {
          id?: string
          location_id?: string
          notes?: string | null
          organisation_id?: string
          purchase_order_id?: string
          received_at?: string
          received_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inductees: {
        Row: {
          company: string | null
          created_at: string
          created_by: string | null
          department: string | null
          email: string | null
          full_name: string
          id: string
          id_number: string | null
          inductee_type: string
          organisation_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          full_name: string
          id?: string
          id_number?: string | null
          inductee_type?: string
          organisation_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
          id_number?: string | null
          inductee_type?: string
          organisation_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      induction_module_results: {
        Row: {
          answers_given: Json
          attempts: number
          completed_at: string
          id: string
          induction_record_id: string
          module_id: string
          passed: boolean
          score_percent: number
        }
        Insert: {
          answers_given?: Json
          attempts?: number
          completed_at?: string
          id?: string
          induction_record_id: string
          module_id: string
          passed?: boolean
          score_percent?: number
        }
        Update: {
          answers_given?: Json
          attempts?: number
          completed_at?: string
          id?: string
          induction_record_id?: string
          module_id?: string
          passed?: boolean
          score_percent?: number
        }
        Relationships: []
      }
      induction_modules: {
        Row: {
          content_text: string | null
          content_type: string
          created_at: string
          document_url: string | null
          has_quiz: boolean
          id: string
          order_index: number
          programme_id: string
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          content_text?: string | null
          content_type?: string
          created_at?: string
          document_url?: string | null
          has_quiz?: boolean
          id?: string
          order_index?: number
          programme_id: string
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          content_text?: string | null
          content_type?: string
          created_at?: string
          document_url?: string | null
          has_quiz?: boolean
          id?: string
          order_index?: number
          programme_id?: string
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      induction_programmes: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          inductee_type: string
          is_active: boolean
          name: string
          organisation_id: string
          pass_mark_percent: number
          qr_self_service_enabled: boolean
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          inductee_type?: string
          is_active?: boolean
          name: string
          organisation_id: string
          pass_mark_percent?: number
          qr_self_service_enabled?: boolean
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          inductee_type?: string
          is_active?: boolean
          name?: string
          organisation_id?: string
          pass_mark_percent?: number
          qr_self_service_enabled?: boolean
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: []
      }
      induction_quiz_questions: {
        Row: {
          correct_answer: string
          created_at: string
          id: string
          module_id: string
          options: Json
          order_index: number
          question_text: string
          question_type: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          id?: string
          module_id: string
          options?: Json
          order_index?: number
          question_text: string
          question_type?: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          id?: string
          module_id?: string
          options?: Json
          order_index?: number
          question_text?: string
          question_type?: string
        }
        Relationships: []
      }
      induction_records: {
        Row: {
          completed_at: string | null
          created_at: string
          digital_signature_url: string | null
          expires_at: string | null
          id: string
          inducted_by: string | null
          inductee_id: string
          organisation_id: string
          overall_score_percent: number | null
          programme_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          digital_signature_url?: string | null
          expires_at?: string | null
          id?: string
          inducted_by?: string | null
          inductee_id: string
          organisation_id: string
          overall_score_percent?: number | null
          programme_id: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          digital_signature_url?: string | null
          expires_at?: string | null
          id?: string
          inducted_by?: string | null
          inductee_id?: string
          organisation_id?: string
          overall_score_percent?: number | null
          programme_id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      induction_reminders: {
        Row: {
          channel: string
          id: string
          induction_record_id: string
          organisation_id: string
          reminded_at: string
          reminded_by: string | null
        }
        Insert: {
          channel?: string
          id?: string
          induction_record_id: string
          organisation_id: string
          reminded_at?: string
          reminded_by?: string | null
        }
        Update: {
          channel?: string
          id?: string
          induction_record_id?: string
          organisation_id?: string
          reminded_at?: string
          reminded_by?: string | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          avg_monthly_consumption: number | null
          backup_supplier: string | null
          barcode: string | null
          brand: string | null
          category: string | null
          created_at: string
          criticality: string
          id: string
          image_url: string | null
          item_type: string
          last_low_stock_notified_at: string | null
          lead_time_days: number | null
          location: string | null
          manufacturer: string | null
          manufacturer_part_number: string | null
          max_stock: number | null
          name: string
          notes: string | null
          order_expected_at: string | null
          order_note: string | null
          order_status: string
          ordered_at: string | null
          organisation_id: string
          part_number: string | null
          quantity: number
          reorder_level: number
          reorder_quantity: number | null
          safety_stock: number | null
          selling_price: number | null
          sku: string | null
          status: string
          supplier: string | null
          technical_specs: string | null
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          avg_monthly_consumption?: number | null
          backup_supplier?: string | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          criticality?: string
          id?: string
          image_url?: string | null
          item_type?: string
          last_low_stock_notified_at?: string | null
          lead_time_days?: number | null
          location?: string | null
          manufacturer?: string | null
          manufacturer_part_number?: string | null
          max_stock?: number | null
          name: string
          notes?: string | null
          order_expected_at?: string | null
          order_note?: string | null
          order_status?: string
          ordered_at?: string | null
          organisation_id: string
          part_number?: string | null
          quantity?: number
          reorder_level?: number
          reorder_quantity?: number | null
          safety_stock?: number | null
          selling_price?: number | null
          sku?: string | null
          status?: string
          supplier?: string | null
          technical_specs?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          avg_monthly_consumption?: number | null
          backup_supplier?: string | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          criticality?: string
          id?: string
          image_url?: string | null
          item_type?: string
          last_low_stock_notified_at?: string | null
          lead_time_days?: number | null
          location?: string | null
          manufacturer?: string | null
          manufacturer_part_number?: string | null
          max_stock?: number | null
          name?: string
          notes?: string | null
          order_expected_at?: string | null
          order_note?: string | null
          order_status?: string
          ordered_at?: string | null
          organisation_id?: string
          part_number?: string | null
          quantity?: number
          reorder_level?: number
          reorder_quantity?: number | null
          safety_stock?: number | null
          selling_price?: number | null
          sku?: string | null
          status?: string
          supplier?: string | null
          technical_specs?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_items: {
        Row: {
          category: string
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          machine_id: string
          title: string
        }
        Insert: {
          category?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id: string
          title: string
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_items_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_checklist_items: {
        Row: {
          applies_to: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          interval_days: number | null
          interval_hours: number | null
          machine_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          applies_to?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          machine_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          applies_to?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          machine_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_checklist_items_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_downtime_events: {
        Row: {
          created_at: string
          created_by: string | null
          ended_at: string | null
          id: string
          machine_id: string
          notes: string | null
          organisation_id: string
          reason: string
          started_at: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          machine_id: string
          notes?: string | null
          organisation_id: string
          reason?: string
          started_at?: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          machine_id?: string
          notes?: string | null
          organisation_id?: string
          reason?: string
          started_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_downtime_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_downtime_events_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_downtime_events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_downtime_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_parts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_required: boolean
          item_id: string
          machine_id: string
          notes: string | null
          organisation_id: string
          quantity_per_unit: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_required?: boolean
          item_id: string
          machine_id: string
          notes?: string | null
          organisation_id: string
          quantity_per_unit?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_required?: boolean
          item_id?: string
          machine_id?: string
          notes?: string | null
          organisation_id?: string
          quantity_per_unit?: number
        }
        Relationships: [
          {
            foreignKeyName: "machine_parts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_parts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_parts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_parts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_pm_parts: {
        Row: {
          checklist_item_id: string | null
          created_at: string
          created_by: string | null
          id: string
          machine_id: string
          notes: string | null
          part_name: string
          part_number: string | null
          quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          checklist_item_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id: string
          notes?: string | null
          part_name: string
          part_number?: string | null
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          checklist_item_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id?: string
          notes?: string | null
          part_name?: string
          part_number?: string | null
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      machine_safety_profiles: {
        Row: {
          created_at: string
          emergency_stop_installed: boolean
          energy_sources: string[]
          hazards: string[]
          id: string
          loto_procedure_url: string | null
          machine_id: string
          notes: string | null
          organisation_id: string
          required_competencies: string[]
          required_permit_types: string[]
          required_ppe: string[]
          safety_guards_installed: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          emergency_stop_installed?: boolean
          energy_sources?: string[]
          hazards?: string[]
          id?: string
          loto_procedure_url?: string | null
          machine_id: string
          notes?: string | null
          organisation_id: string
          required_competencies?: string[]
          required_permit_types?: string[]
          required_ppe?: string[]
          safety_guards_installed?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          emergency_stop_installed?: boolean
          energy_sources?: string[]
          hazards?: string[]
          id?: string
          loto_procedure_url?: string | null
          machine_id?: string
          notes?: string | null
          organisation_id?: string
          required_competencies?: string[]
          required_permit_types?: string[]
          required_ppe?: string[]
          safety_guards_installed?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_safety_profiles_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: true
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_safety_profiles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_safety_profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: string | null
          id: string
          machine_id: string
          organisation_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          machine_id: string
          organisation_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          machine_id?: string
          organisation_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_status_history_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_status_history_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          category: string
          cover_image_url: string | null
          created_at: string
          current_hours: number | null
          current_odometer_km: number | null
          department: string | null
          fuel_type: string | null
          home_depot: string | null
          id: string
          make: string | null
          model: string | null
          name: string
          notes: string | null
          organisation_id: string
          plate_number: string | null
          purchase_date: string | null
          registration_number: string | null
          serial_number: string | null
          status: string
          tank_capacity_l: number | null
          vin: string | null
          warranty_expiry: string | null
          warranty_provider: string | null
          year: number | null
        }
        Insert: {
          category: string
          cover_image_url?: string | null
          created_at?: string
          current_hours?: number | null
          current_odometer_km?: number | null
          department?: string | null
          fuel_type?: string | null
          home_depot?: string | null
          id?: string
          make?: string | null
          model?: string | null
          name: string
          notes?: string | null
          organisation_id: string
          plate_number?: string | null
          purchase_date?: string | null
          registration_number?: string | null
          serial_number?: string | null
          status?: string
          tank_capacity_l?: number | null
          vin?: string | null
          warranty_expiry?: string | null
          warranty_provider?: string | null
          year?: number | null
        }
        Update: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          current_hours?: number | null
          current_odometer_km?: number | null
          department?: string | null
          fuel_type?: string | null
          home_depot?: string | null
          id?: string
          make?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          organisation_id?: string
          plate_number?: string | null
          purchase_date?: string | null
          registration_number?: string | null
          serial_number?: string | null
          status?: string
          tank_capacity_l?: number | null
          vin?: string | null
          warranty_expiry?: string | null
          warranty_provider?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_email_runs: {
        Row: {
          due_soon_count: number
          emails_sent: number
          error_message: string | null
          id: string
          organisation_id: string
          overdue_count: number
          ran_at: string
          sms_sent: number
          status: string
        }
        Insert: {
          due_soon_count?: number
          emails_sent?: number
          error_message?: string | null
          id?: string
          organisation_id: string
          overdue_count?: number
          ran_at?: string
          sms_sent?: number
          status?: string
        }
        Update: {
          due_soon_count?: number
          emails_sent?: number
          error_message?: string | null
          id?: string
          organisation_id?: string
          overdue_count?: number
          ran_at?: string
          sms_sent?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_email_runs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_notifications: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          closed_at: string | null
          created_at: string
          description: string | null
          id: string
          machine_id: string | null
          organisation_id: string
          reported_by: string | null
          severity: string
          status: string
          title: string
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          machine_id?: string | null
          organisation_id: string
          reported_by?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          machine_id?: string | null
          organisation_id?: string
          reported_by?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_notifications_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_notifications_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_notifications_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      material_request_items: {
        Row: {
          id: string
          item_id: string
          location_id: string
          material_request_id: string
          notes: string | null
          quantity_approved: number | null
          quantity_issued: number
          quantity_requested: number
          quantity_returned: number
          status: string
        }
        Insert: {
          id?: string
          item_id: string
          location_id: string
          material_request_id: string
          notes?: string | null
          quantity_approved?: number | null
          quantity_issued?: number
          quantity_requested: number
          quantity_returned?: number
          status?: string
        }
        Update: {
          id?: string
          item_id?: string
          location_id?: string
          material_request_id?: string
          notes?: string | null
          quantity_approved?: number | null
          quantity_issued?: number
          quantity_requested?: number
          quantity_returned?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_request_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_request_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_request_items_material_request_id_fkey"
            columns: ["material_request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          created_at: string
          id: string
          machine_id: string | null
          organisation_id: string
          requested_by: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          machine_id?: string | null
          organisation_id: string
          requested_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          machine_id?: string | null
          organisation_id?: string
          requested_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      meter_readings: {
        Row: {
          created_at: string
          id: string
          machine_id: string
          notes: string | null
          organisation_id: string
          reading: number
          reading_date: string
          recorded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          machine_id: string
          notes?: string | null
          organisation_id: string
          reading: number
          reading_date?: string
          recorded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          machine_id?: string
          notes?: string | null
          organisation_id?: string
          reading?: number
          reading_date?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meter_readings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meter_readings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meter_readings_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      oee_records: {
        Row: {
          availability: number | null
          created_at: string
          created_by: string | null
          downtime_minutes: number
          id: string
          ideal_cycle_seconds: number
          machine_id: string
          notes: string | null
          organisation_id: string
          performance: number | null
          planned_minutes: number
          quality: number | null
          record_date: string
          shift: string
          source: string
          units_good: number
          units_produced: number
          updated_at: string
        }
        Insert: {
          availability?: number | null
          created_at?: string
          created_by?: string | null
          downtime_minutes?: number
          id?: string
          ideal_cycle_seconds?: number
          machine_id: string
          notes?: string | null
          organisation_id: string
          performance?: number | null
          planned_minutes: number
          quality?: number | null
          record_date: string
          shift?: string
          source?: string
          units_good?: number
          units_produced?: number
          updated_at?: string
        }
        Update: {
          availability?: number | null
          created_at?: string
          created_by?: string | null
          downtime_minutes?: number
          id?: string
          ideal_cycle_seconds?: number
          machine_id?: string
          notes?: string | null
          organisation_id?: string
          performance?: number | null
          planned_minutes?: number
          quality?: number | null
          record_date?: string
          shift?: string
          source?: string
          units_good?: number
          units_produced?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oee_records_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oee_records_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organisation_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organisation_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organisation_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invoice_counters: {
        Row: {
          next_number: number
          organisation_id: string
          updated_at: string
          year: number
        }
        Insert: {
          next_number?: number
          organisation_id: string
          updated_at?: string
          year: number
        }
        Update: {
          next_number?: number
          organisation_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_invoice_counters_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_job_counters: {
        Row: {
          next_number: number
          organisation_id: string
          updated_at: string
          year: number
        }
        Insert: {
          next_number?: number
          organisation_id: string
          updated_at?: string
          year: number
        }
        Update: {
          next_number?: number
          organisation_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_job_counters_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_po_counters: {
        Row: {
          next_number: number
          organisation_id: string
          updated_at: string
          year: number
        }
        Insert: {
          next_number?: number
          organisation_id: string
          updated_at?: string
          year: number
        }
        Update: {
          next_number?: number
          organisation_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_po_counters_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_pr_counters: {
        Row: {
          next_number: number
          organisation_id: string
          updated_at: string
          year: number
        }
        Insert: {
          next_number?: number
          organisation_id: string
          updated_at?: string
          year: number
        }
        Update: {
          next_number?: number
          organisation_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_pr_counters_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_prodorder_counters: {
        Row: {
          next_number: number
          organisation_id: string
          updated_at: string
          year: number
        }
        Insert: {
          next_number?: number
          organisation_id: string
          updated_at?: string
          year: number
        }
        Update: {
          next_number?: number
          organisation_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_prodorder_counters_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_wo_counters: {
        Row: {
          next_number: number
          organisation_id: string
          updated_at: string
          year: number
        }
        Insert: {
          next_number?: number
          organisation_id: string
          updated_at?: string
          year: number
        }
        Update: {
          next_number?: number
          organisation_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_wo_counters_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          block_expired_calibration_checkout: boolean
          created_at: string
          id: string
          industry: string | null
          industry_profile: Database["public"]["Enums"]["industry_profile"]
          logo_url: string | null
          maintenance_alerts_sms_enabled: boolean
          name: string
          notifications_enabled: boolean
          notifications_lead_days: number
          notifications_notify_engineers: boolean
          notifications_notify_managers: boolean
          notifications_notify_technicians: boolean
          notifications_system_inbox: string | null
          plan: string
          production_alert_attainment_threshold: number | null
          production_alert_downtime_minutes: number | null
          production_alerts_sms_enabled: boolean
          production_cost_per_downtime_minute: number | null
          production_cost_per_scrap_unit: number | null
          stock_count_variance_approval_threshold: number | null
        }
        Insert: {
          block_expired_calibration_checkout?: boolean
          created_at?: string
          id?: string
          industry?: string | null
          industry_profile?: Database["public"]["Enums"]["industry_profile"]
          logo_url?: string | null
          maintenance_alerts_sms_enabled?: boolean
          name: string
          notifications_enabled?: boolean
          notifications_lead_days?: number
          notifications_notify_engineers?: boolean
          notifications_notify_managers?: boolean
          notifications_notify_technicians?: boolean
          notifications_system_inbox?: string | null
          plan?: string
          production_alert_attainment_threshold?: number | null
          production_alert_downtime_minutes?: number | null
          production_alerts_sms_enabled?: boolean
          production_cost_per_downtime_minute?: number | null
          production_cost_per_scrap_unit?: number | null
          stock_count_variance_approval_threshold?: number | null
        }
        Update: {
          block_expired_calibration_checkout?: boolean
          created_at?: string
          id?: string
          industry?: string | null
          industry_profile?: Database["public"]["Enums"]["industry_profile"]
          logo_url?: string | null
          maintenance_alerts_sms_enabled?: boolean
          name?: string
          notifications_enabled?: boolean
          notifications_lead_days?: number
          notifications_notify_engineers?: boolean
          notifications_notify_managers?: boolean
          notifications_notify_technicians?: boolean
          notifications_system_inbox?: string | null
          plan?: string
          production_alert_attainment_threshold?: number | null
          production_alert_downtime_minutes?: number | null
          production_alerts_sms_enabled?: boolean
          production_cost_per_downtime_minute?: number | null
          production_cost_per_scrap_unit?: number | null
          stock_count_variance_approval_threshold?: number | null
        }
        Relationships: []
      }
      ppe_issues: {
        Row: {
          condition: string
          contractor_worker_id: string | null
          created_at: string
          employee_id: string | null
          expiry_date: string | null
          id: string
          inventory_item_id: string | null
          issued_at: string
          issued_by: string | null
          notes: string | null
          organisation_id: string
          ppe_type: string
          quantity: number
          replacement_date: string | null
          returned_at: string | null
          size: string | null
          status: string
        }
        Insert: {
          condition?: string
          contractor_worker_id?: string | null
          created_at?: string
          employee_id?: string | null
          expiry_date?: string | null
          id?: string
          inventory_item_id?: string | null
          issued_at?: string
          issued_by?: string | null
          notes?: string | null
          organisation_id: string
          ppe_type: string
          quantity?: number
          replacement_date?: string | null
          returned_at?: string | null
          size?: string | null
          status?: string
        }
        Update: {
          condition?: string
          contractor_worker_id?: string | null
          created_at?: string
          employee_id?: string | null
          expiry_date?: string | null
          id?: string
          inventory_item_id?: string | null
          issued_at?: string
          issued_by?: string | null
          notes?: string | null
          organisation_id?: string
          ppe_type?: string
          quantity?: number
          replacement_date?: string | null
          returned_at?: string | null
          size?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppe_issues_contractor_worker_id_fkey"
            columns: ["contractor_worker_id"]
            isOneToOne: false
            referencedRelation: "contractor_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppe_issues_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppe_issues_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppe_issues_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppe_issues_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      ppe_requirements: {
        Row: {
          activity: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organisation_id: string
          required_ppe: string[]
        }
        Insert: {
          activity: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organisation_id: string
          required_ppe?: string[]
        }
        Update: {
          activity?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string
          required_ppe?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "ppe_requirements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppe_requirements_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_materials: {
        Row: {
          created_at: string
          id: string
          item_id: string
          notes: string | null
          organisation_id: string
          product_id: string
          qty_per_unit: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          organisation_id: string
          product_id: string
          qty_per_unit: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          organisation_id?: string
          product_id?: string
          qty_per_unit?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_materials_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_materials_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_downtime_events: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          duration_minutes: number
          id: string
          machine_id: string | null
          notes: string | null
          organisation_id: string
          production_kpi_id: string
          reason_code: string
          record_date: string
          work_order_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          duration_minutes: number
          id?: string
          machine_id?: string | null
          notes?: string | null
          organisation_id: string
          production_kpi_id: string
          reason_code: string
          record_date: string
          work_order_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          machine_id?: string | null
          notes?: string | null
          organisation_id?: string
          production_kpi_id?: string
          reason_code?: string
          record_date?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_downtime_events_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_downtime_events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_downtime_events_production_kpi_id_fkey"
            columns: ["production_kpi_id"]
            isOneToOne: false
            referencedRelation: "production_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_downtime_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_kpis: {
        Row: {
          actual_units: number
          approved_at: string | null
          approved_by: string | null
          attainment_percent: number | null
          created_at: string
          downtime_minutes: number
          id: string
          ideal_cycle_seconds: number | null
          log_status: string
          machine_id: string | null
          notes: string | null
          operator: string | null
          organisation_id: string
          planned_minutes: number | null
          product: string | null
          product_id: string | null
          production_line: string | null
          record_date: string
          scrap_units: number
          shift: string | null
          target_units: number
          updated_at: string
        }
        Insert: {
          actual_units?: number
          approved_at?: string | null
          approved_by?: string | null
          attainment_percent?: number | null
          created_at?: string
          downtime_minutes?: number
          id?: string
          ideal_cycle_seconds?: number | null
          log_status?: string
          machine_id?: string | null
          notes?: string | null
          operator?: string | null
          organisation_id: string
          planned_minutes?: number | null
          product?: string | null
          product_id?: string | null
          production_line?: string | null
          record_date?: string
          scrap_units?: number
          shift?: string | null
          target_units?: number
          updated_at?: string
        }
        Update: {
          actual_units?: number
          approved_at?: string | null
          approved_by?: string | null
          attainment_percent?: number | null
          created_at?: string
          downtime_minutes?: number
          id?: string
          ideal_cycle_seconds?: number | null
          log_status?: string
          machine_id?: string | null
          notes?: string | null
          operator?: string | null
          organisation_id?: string
          planned_minutes?: number | null
          product?: string | null
          product_id?: string | null
          production_line?: string | null
          record_date?: string
          scrap_units?: number
          shift?: string | null
          target_units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_kpis_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_kpis_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_kpis_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_kpis_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organisation_id: string
          planned_end_date: string | null
          planned_start_date: string | null
          po_number: number | null
          po_year: number | null
          priority: string
          product: string
          production_line: string | null
          quantity_ordered: number
          quantity_produced: number
          shift: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organisation_id: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          po_number?: number | null
          po_year?: number | null
          priority?: string
          product: string
          production_line?: string | null
          quantity_ordered?: number
          quantity_produced?: number
          shift?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          po_number?: number | null
          po_year?: number | null
          priority?: string
          product?: string
          production_line?: string | null
          quantity_ordered?: number
          quantity_produced?: number
          shift?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      production_plans: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organisation_id: string
          plan_date: string
          planned_minutes: number | null
          product: string | null
          production_line: string | null
          shift: string | null
          target_units: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organisation_id: string
          plan_date: string
          planned_minutes?: number | null
          product?: string | null
          production_line?: string | null
          shift?: string | null
          target_units?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string
          plan_date?: string
          planned_minutes?: number | null
          product?: string | null
          production_line?: string | null
          shift?: string | null
          target_units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_plans_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      production_scrap_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          machine_id: string | null
          notes: string | null
          organisation_id: string
          production_kpi_id: string
          quantity: number
          reason_code: string
          record_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          organisation_id: string
          production_kpi_id: string
          quantity: number
          reason_code: string
          record_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          organisation_id?: string
          production_kpi_id?: string
          quantity?: number
          reason_code?: string
          record_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_scrap_events_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_scrap_events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_scrap_events_production_kpi_id_fkey"
            columns: ["production_kpi_id"]
            isOneToOne: false
            referencedRelation: "production_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          id: string
          ideal_cycle_seconds: number | null
          is_active: boolean
          name: string
          organisation_id: string
          sku: string | null
          standard_changeover_minutes: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          ideal_cycle_seconds?: number | null
          is_active?: boolean
          name: string
          organisation_id: string
          sku?: string | null
          standard_changeover_minutes?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          ideal_cycle_seconds?: number | null
          is_active?: boolean
          name?: string
          organisation_id?: string
          sku?: string | null
          standard_changeover_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          full_name: string | null
          id: string
          organisation_id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          full_name?: string | null
          id: string
          organisation_id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          full_name?: string | null
          id?: string
          organisation_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_approval_rules: {
        Row: {
          approver_department: string | null
          created_at: string
          id: string
          label: string
          max_amount: number | null
          min_amount: number
          organisation_id: string
        }
        Insert: {
          approver_department?: string | null
          created_at?: string
          id?: string
          label: string
          max_amount?: number | null
          min_amount?: number
          organisation_id: string
        }
        Update: {
          approver_department?: string | null
          created_at?: string
          id?: string
          label?: string
          max_amount?: number | null
          min_amount?: number
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_approval_rules_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          id: string
          item_description: string | null
          item_id: string | null
          purchase_order_id: string
          quantity: number
          quantity_received: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          id?: string
          item_description?: string | null
          item_id?: string | null
          purchase_order_id: string
          quantity: number
          quantity_received?: number
          tax_rate?: number
          unit_price?: number
        }
        Update: {
          id?: string
          item_description?: string | null
          item_id?: string | null
          purchase_order_id?: string
          quantity?: number
          quantity_received?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          delivery_date: string | null
          id: string
          organisation_id: string
          payment_terms: string | null
          po_number: number | null
          po_year: number | null
          purchase_request_id: string | null
          status: string
          supplier_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivery_date?: string | null
          id?: string
          organisation_id: string
          payment_terms?: string | null
          po_number?: number | null
          po_year?: number | null
          purchase_request_id?: string | null
          status?: string
          supplier_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivery_date?: string | null
          id?: string
          organisation_id?: string
          payment_terms?: string | null
          po_number?: number | null
          po_year?: number | null
          purchase_request_id?: string | null
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_items: {
        Row: {
          estimated_unit_price: number | null
          id: string
          item_description: string | null
          item_id: string | null
          preferred_supplier_id: string | null
          purchase_request_id: string
          quantity: number
        }
        Insert: {
          estimated_unit_price?: number | null
          id?: string
          item_description?: string | null
          item_id?: string | null
          preferred_supplier_id?: string | null
          purchase_request_id: string
          quantity: number
        }
        Update: {
          estimated_unit_price?: number | null
          id?: string
          item_description?: string | null
          item_id?: string | null
          preferred_supplier_id?: string | null
          purchase_request_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_items_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_items_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          created_at: string
          department: string | null
          id: string
          material_request_id: string | null
          organisation_id: string
          pr_number: number | null
          pr_year: number | null
          priority: string
          reason: string | null
          requested_by: string | null
          required_date: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          id?: string
          material_request_id?: string | null
          organisation_id: string
          pr_number?: number | null
          pr_year?: number | null
          priority?: string
          reason?: string | null
          requested_by?: string | null
          required_date?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          id?: string
          material_request_id?: string | null
          organisation_id?: string
          pr_number?: number | null
          pr_year?: number | null
          priority?: string
          reason?: string | null
          requested_by?: string | null
          required_date?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_material_request_id_fkey"
            columns: ["material_request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_reports: {
        Row: {
          corrective_action: string | null
          created_at: string
          defect_category: string | null
          id: string
          inspector: string | null
          machine_id: string | null
          notes: string | null
          organisation_id: string
          product: string | null
          report_date: string
          root_cause: string | null
          units_defective: number
          units_inspected: number
          units_rework: number
          units_scrap: number
          updated_at: string
          yield_percent: number | null
        }
        Insert: {
          corrective_action?: string | null
          created_at?: string
          defect_category?: string | null
          id?: string
          inspector?: string | null
          machine_id?: string | null
          notes?: string | null
          organisation_id: string
          product?: string | null
          report_date?: string
          root_cause?: string | null
          units_defective?: number
          units_inspected?: number
          units_rework?: number
          units_scrap?: number
          updated_at?: string
          yield_percent?: number | null
        }
        Update: {
          corrective_action?: string | null
          created_at?: string
          defect_category?: string | null
          id?: string
          inspector?: string | null
          machine_id?: string | null
          notes?: string | null
          organisation_id?: string
          product?: string | null
          report_date?: string
          root_cause?: string | null
          units_defective?: number
          units_inspected?: number
          units_rework?: number
          units_scrap?: number
          updated_at?: string
          yield_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_reports_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_reports_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessment_items: {
        Row: {
          consequence: string | null
          control_measure: string | null
          hazard: string
          id: string
          initial_risk: string | null
          likelihood: number | null
          order_index: number
          residual_likelihood: number | null
          residual_risk: string | null
          residual_severity: number | null
          responsible_person: string | null
          risk_assessment_id: string
          severity: number | null
          step: string | null
        }
        Insert: {
          consequence?: string | null
          control_measure?: string | null
          hazard: string
          id?: string
          initial_risk?: string | null
          likelihood?: number | null
          order_index?: number
          residual_likelihood?: number | null
          residual_risk?: string | null
          residual_severity?: number | null
          responsible_person?: string | null
          risk_assessment_id: string
          severity?: number | null
          step?: string | null
        }
        Update: {
          consequence?: string | null
          control_measure?: string | null
          hazard?: string
          id?: string
          initial_risk?: string | null
          likelihood?: number | null
          order_index?: number
          residual_likelihood?: number | null
          residual_risk?: string | null
          residual_severity?: number | null
          responsible_person?: string | null
          risk_assessment_id?: string
          severity?: number | null
          step?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessment_items_risk_assessment_id_fkey"
            columns: ["risk_assessment_id"]
            isOneToOne: false
            referencedRelation: "risk_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessments: {
        Row: {
          activity: string | null
          created_at: string
          created_by: string | null
          id: string
          machine_id: string | null
          organisation_id: string
          overall_risk: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          title: string
          work_order_id: string | null
        }
        Insert: {
          activity?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id?: string | null
          organisation_id: string
          overall_risk?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          title: string
          work_order_id?: string | null
        }
        Update: {
          activity?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id?: string | null
          organisation_id?: string
          overall_risk?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          title?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_documents: {
        Row: {
          category: string
          content: string | null
          created_at: string
          expiry_date: string | null
          file_type: string | null
          file_url: string | null
          id: string
          machine_id: string | null
          organisation_id: string
          owner: string | null
          review_date: string | null
          status: string
          title: string
          uploaded_by: string | null
          version: string | null
        }
        Insert: {
          category?: string
          content?: string | null
          created_at?: string
          expiry_date?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          machine_id?: string | null
          organisation_id: string
          owner?: string | null
          review_date?: string | null
          status?: string
          title: string
          uploaded_by?: string | null
          version?: string | null
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          expiry_date?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          machine_id?: string | null
          organisation_id?: string
          owner?: string | null
          review_date?: string | null
          status?: string
          title?: string
          uploaded_by?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_documents_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_documents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_documents_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_equipment: {
        Row: {
          asset_tag: string | null
          certificate_expiry: string | null
          certificate_url: string | null
          condition: string
          created_at: string
          created_by: string | null
          equipment_type: string
          id: string
          inspection_frequency_days: number
          last_inspection_date: string | null
          location: string | null
          name: string
          next_inspection_date: string | null
          notes: string | null
          organisation_id: string
        }
        Insert: {
          asset_tag?: string | null
          certificate_expiry?: string | null
          certificate_url?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          equipment_type?: string
          id?: string
          inspection_frequency_days?: number
          last_inspection_date?: string | null
          location?: string | null
          name: string
          next_inspection_date?: string | null
          notes?: string | null
          organisation_id: string
        }
        Update: {
          asset_tag?: string | null
          certificate_expiry?: string | null
          certificate_url?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          equipment_type?: string
          id?: string
          inspection_frequency_days?: number
          last_inspection_date?: string | null
          location?: string | null
          name?: string
          next_inspection_date?: string | null
          notes?: string | null
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_equipment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_equipment_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_incidents: {
        Row: {
          closed_at: string | null
          corrective_action: string | null
          created_at: string
          description: string
          id: string
          immediate_action: string | null
          incident_type: string
          location: string | null
          lost_time_hours: number | null
          machine_id: string | null
          occurred_at: string
          organisation_id: string
          persons_involved: string | null
          reported_by: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          corrective_action?: string | null
          created_at?: string
          description: string
          id?: string
          immediate_action?: string | null
          incident_type?: string
          location?: string | null
          lost_time_hours?: number | null
          machine_id?: string | null
          occurred_at?: string
          organisation_id: string
          persons_involved?: string | null
          reported_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          corrective_action?: string | null
          created_at?: string
          description?: string
          id?: string
          immediate_action?: string | null
          incident_type?: string
          location?: string | null
          lost_time_hours?: number | null
          machine_id?: string | null
          occurred_at?: string
          organisation_id?: string
          persons_involved?: string | null
          reported_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_incidents_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_incidents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_inspection_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          items: Json
          name: string
          organisation_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          items?: Json
          name: string
          organisation_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          items?: Json
          name?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_inspection_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_inspection_templates_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_inspections: {
        Row: {
          created_at: string
          id: string
          inspected_at: string
          inspected_by: string | null
          items: Json
          location: string | null
          machine_id: string | null
          notes: string | null
          organisation_id: string
          overall_result: string | null
          template_id: string | null
          template_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspected_at?: string
          inspected_by?: string | null
          items?: Json
          location?: string | null
          machine_id?: string | null
          notes?: string | null
          organisation_id: string
          overall_result?: string | null
          template_id?: string | null
          template_name: string
        }
        Update: {
          created_at?: string
          id?: string
          inspected_at?: string
          inspected_by?: string | null
          items?: Json
          location?: string | null
          machine_id?: string | null
          notes?: string | null
          organisation_id?: string
          overall_result?: string | null
          template_id?: string | null
          template_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_inspections_inspected_by_fkey"
            columns: ["inspected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_inspections_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_inspections_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_inspections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "safety_inspection_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_rules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          match_field: string
          match_value: string
          name: string
          organisation_id: string
          required_ppe: string[]
          requires_competency: string | null
          requires_loto: boolean
          requires_ptw: boolean
          requires_risk_assessment: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          match_field?: string
          match_value: string
          name: string
          organisation_id: string
          required_ppe?: string[]
          requires_competency?: string | null
          requires_loto?: boolean
          requires_ptw?: boolean
          requires_risk_assessment?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          match_field?: string
          match_value?: string
          name?: string
          organisation_id?: string
          required_ppe?: string[]
          requires_competency?: string | null
          requires_loto?: boolean
          requires_ptw?: boolean
          requires_risk_assessment?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "safety_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_rules_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_logs: {
        Row: {
          cost: number | null
          created_at: string
          currency: string | null
          description: string | null
          hours_at_service: number | null
          id: string
          machine_id: string
          performed_at: string
          performed_by: string | null
          schedule_id: string | null
          service_type: string
          status: string
          title: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          hours_at_service?: number | null
          id?: string
          machine_id: string
          performed_at?: string
          performed_by?: string | null
          schedule_id?: string | null
          service_type: string
          status?: string
          title: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          hours_at_service?: number | null
          id?: string
          machine_id?: string
          performed_at?: string
          performed_by?: string | null
          schedule_id?: string | null
          service_type?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "service_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      service_parts: {
        Row: {
          id: string
          inventory_item_id: string | null
          notes: string | null
          part_name: string
          part_number: string | null
          part_type: string | null
          quantity: number | null
          service_log_id: string
          supplier: string | null
          unit: string | null
          unit_cost: number | null
        }
        Insert: {
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          part_name: string
          part_number?: string | null
          part_type?: string | null
          quantity?: number | null
          service_log_id: string
          supplier?: string | null
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          part_name?: string
          part_number?: string | null
          part_type?: string | null
          quantity?: number | null
          service_log_id?: string
          supplier?: string | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_parts_service_log_id_fkey"
            columns: ["service_log_id"]
            isOneToOne: false
            referencedRelation: "service_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      service_schedules: {
        Row: {
          component: string | null
          created_at: string
          id: string
          instructions: string | null
          interval_days: number | null
          interval_hours: number | null
          last_service_date: string | null
          last_service_hours: number | null
          machine_id: string
          name: string
          next_due_date: string | null
          next_due_hours: number | null
          schedule_label: string | null
          service_type: string
          shutdown_required: boolean
          spares: string | null
          status: string
          sub_assembly: string | null
          trade: string | null
          work_instruction_no: string | null
        }
        Insert: {
          component?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          interval_days?: number | null
          interval_hours?: number | null
          last_service_date?: string | null
          last_service_hours?: number | null
          machine_id: string
          name: string
          next_due_date?: string | null
          next_due_hours?: number | null
          schedule_label?: string | null
          service_type?: string
          shutdown_required?: boolean
          spares?: string | null
          status?: string
          sub_assembly?: string | null
          trade?: string | null
          work_instruction_no?: string | null
        }
        Update: {
          component?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          interval_days?: number | null
          interval_hours?: number | null
          last_service_date?: string | null
          last_service_hours?: number | null
          machine_id?: string
          name?: string
          next_due_date?: string | null
          next_due_hours?: number | null
          schedule_label?: string | null
          service_type?: string
          shutdown_required?: boolean
          spares?: string | null
          status?: string
          sub_assembly?: string | null
          trade?: string | null
          work_instruction_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_schedules_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          message: string
          organisation_id: string
          phone: string
          provider_message_id: string | null
          recipient_user_id: string | null
          status: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          message: string
          organisation_id: string
          phone: string
          provider_message_id?: string | null
          recipient_user_id?: string | null
          status?: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          message?: string
          organisation_id?: string
          phone?: string
          provider_message_id?: string | null
          recipient_user_id?: string | null
          status?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message: string
          metadata: Json | null
          provider: string
          recipient_phone: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message: string
          metadata?: Json | null
          provider?: string
          recipient_phone: string
          status: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          provider?: string
          recipient_phone?: string
          status?: string
        }
        Relationships: []
      }
      stock_balances: {
        Row: {
          available_stock: number | null
          bin: string | null
          damaged_stock: number
          id: string
          item_id: string
          location_id: string
          on_order_stock: number
          organisation_id: string
          physical_stock: number
          quarantine_stock: number
          reserved_stock: number
          updated_at: string
        }
        Insert: {
          available_stock?: number | null
          bin?: string | null
          damaged_stock?: number
          id?: string
          item_id: string
          location_id: string
          on_order_stock?: number
          organisation_id: string
          physical_stock?: number
          quarantine_stock?: number
          reserved_stock?: number
          updated_at?: string
        }
        Update: {
          available_stock?: number | null
          bin?: string | null
          damaged_stock?: number
          id?: string
          item_id?: string
          location_id?: string
          on_order_stock?: number
          organisation_id?: string
          physical_stock?: number
          quarantine_stock?: number
          reserved_stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_balances_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_items: {
        Row: {
          counted_at: string | null
          counted_by: string | null
          expected_quantity: number
          id: string
          item_id: string
          location_id: string
          physical_quantity: number | null
          reason: string | null
          stock_count_id: string
          variance: number | null
        }
        Insert: {
          counted_at?: string | null
          counted_by?: string | null
          expected_quantity?: number
          id?: string
          item_id: string
          location_id: string
          physical_quantity?: number | null
          reason?: string | null
          stock_count_id: string
          variance?: number | null
        }
        Update: {
          counted_at?: string | null
          counted_by?: string | null
          expected_quantity?: number
          id?: string
          item_id?: string
          location_id?: string
          physical_quantity?: number | null
          reason?: string | null
          stock_count_id?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_items_counted_by_fkey"
            columns: ["counted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_stock_count_id_fkey"
            columns: ["stock_count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          category: string | null
          count_type: string
          created_at: string
          created_by: string | null
          id: string
          location_id: string | null
          notes: string | null
          organisation_id: string
          status: string
          submitted_at: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          category?: string | null
          count_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          organisation_id: string
          status?: string
          submitted_at?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          category?: string | null
          count_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          organisation_id?: string
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_locations: {
        Row: {
          area: string | null
          building: string | null
          created_at: string
          id: string
          is_default: boolean
          manager: string | null
          name: string
          organisation_id: string
          site: string | null
          status: string
        }
        Insert: {
          area?: string | null
          building?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          manager?: string | null
          name: string
          organisation_id: string
          site?: string | null
          status?: string
        }
        Update: {
          area?: string | null
          building?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          manager?: string | null
          name?: string
          organisation_id?: string
          site?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_manager_fkey"
            columns: ["manager"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_locations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transactions: {
        Row: {
          balance_after: number | null
          balance_field: string
          created_at: string
          id: string
          item_id: string
          location_id: string | null
          machine_id: string | null
          organisation_id: string
          performed_by: string | null
          quantity: number
          reason: string | null
          reference: string | null
          to_location_id: string | null
          transaction_type: string
          work_order_id: string | null
        }
        Insert: {
          balance_after?: number | null
          balance_field?: string
          created_at?: string
          id?: string
          item_id: string
          location_id?: string | null
          machine_id?: string | null
          organisation_id: string
          performed_by?: string | null
          quantity: number
          reason?: string | null
          reference?: string | null
          to_location_id?: string | null
          transaction_type: string
          work_order_id?: string | null
        }
        Update: {
          balance_after?: number | null
          balance_field?: string
          created_at?: string
          id?: string
          item_id?: string
          location_id?: string | null
          machine_id?: string | null
          organisation_id?: string
          performed_by?: string | null
          quantity?: number
          reason?: string | null
          reference?: string | null
          to_location_id?: string | null
          transaction_type?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          categories: string[]
          contact_name: string | null
          created_at: string
          created_by: string | null
          currency: string
          email: string | null
          id: string
          lead_time_days: number | null
          name: string
          notes: string | null
          organisation_id: string
          payment_terms: string | null
          phone: string | null
          rating: number | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          categories?: string[]
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          email?: string | null
          id?: string
          lead_time_days?: number | null
          name: string
          notes?: string | null
          organisation_id: string
          payment_terms?: string | null
          phone?: string | null
          rating?: number | null
        }
        Update: {
          active?: boolean
          address?: string | null
          categories?: string[]
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          email?: string | null
          id?: string
          lead_time_days?: number | null
          name?: string
          notes?: string | null
          organisation_id?: string
          payment_terms?: string | null
          phone?: string | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          cargo_description: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          destination: string | null
          driver_id: string | null
          end_at: string | null
          end_odo: number | null
          fuel_log_id: string | null
          fuel_used_l: number | null
          id: string
          machine_id: string
          organisation_id: string
          origin: string | null
          purpose: string | null
          start_at: string | null
          start_odo: number | null
          status: string
          updated_at: string
        }
        Insert: {
          cargo_description?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          driver_id?: string | null
          end_at?: string | null
          end_odo?: number | null
          fuel_log_id?: string | null
          fuel_used_l?: number | null
          id?: string
          machine_id: string
          organisation_id: string
          origin?: string | null
          purpose?: string | null
          start_at?: string | null
          start_odo?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          cargo_description?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          driver_id?: string | null
          end_at?: string | null
          end_odo?: number | null
          fuel_log_id?: string | null
          fuel_used_l?: number | null
          id?: string
          machine_id?: string
          organisation_id?: string
          origin?: string | null
          purpose?: string | null
          start_at?: string | null
          start_odo?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_fuel_log_id_fkey"
            columns: ["fuel_log_id"]
            isOneToOne: false
            referencedRelation: "fuel_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      tyres: {
        Row: {
          brand: string | null
          created_at: string
          current_tread_mm: number | null
          fitted_at: string | null
          fitted_odo: number | null
          id: string
          machine_id: string
          notes: string | null
          organisation_id: string
          position: string
          removed_at: string | null
          removed_reason: string | null
          serial: string | null
          size: string | null
          target_replace_km: number | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          current_tread_mm?: number | null
          fitted_at?: string | null
          fitted_odo?: number | null
          id?: string
          machine_id: string
          notes?: string | null
          organisation_id: string
          position: string
          removed_at?: string | null
          removed_reason?: string | null
          serial?: string | null
          size?: string | null
          target_replace_km?: number | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          current_tread_mm?: number | null
          fitted_at?: string | null
          fitted_odo?: number | null
          id?: string
          machine_id?: string
          notes?: string | null
          organisation_id?: string
          position?: string
          removed_at?: string | null
          removed_reason?: string | null
          serial?: string | null
          size?: string | null
          target_replace_km?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tyres_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tyres_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organisation_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      utilities_kpis: {
        Row: {
          consumption: number
          cost: number
          created_at: string
          currency: string
          id: string
          meter_reading: number | null
          notes: string | null
          organisation_id: string
          record_date: string
          unit: string
          updated_at: string
          utility_type: string
        }
        Insert: {
          consumption?: number
          cost?: number
          created_at?: string
          currency?: string
          id?: string
          meter_reading?: number | null
          notes?: string | null
          organisation_id: string
          record_date?: string
          unit?: string
          updated_at?: string
          utility_type?: string
        }
        Update: {
          consumption?: number
          cost?: number
          created_at?: string
          currency?: string
          id?: string
          meter_reading?: number | null
          notes?: string | null
          organisation_id?: string
          record_date?: string
          unit?: string
          updated_at?: string
          utility_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "utilities_kpis_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_documents: {
        Row: {
          created_at: string
          doc_type: string
          expires_on: string | null
          file_url: string | null
          id: string
          issued_on: string | null
          machine_id: string
          notes: string | null
          number: string | null
          organisation_id: string
          reminder_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          expires_on?: string | null
          file_url?: string | null
          id?: string
          issued_on?: string | null
          machine_id: string
          notes?: string | null
          number?: string | null
          organisation_id: string
          reminder_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          expires_on?: string | null
          file_url?: string | null
          id?: string
          issued_on?: string | null
          machine_id?: string
          notes?: string | null
          number?: string | null
          organisation_id?: string
          reminder_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_documents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          active: boolean
          address: string | null
          category: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organisation_id: string
          phone: string | null
          specialties: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          category?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organisation_id: string
          phone?: string | null
          specialties?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          category?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organisation_id?: string
          phone?: string | null
          specialties?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      wo_close_approvals: {
        Row: {
          created_at: string
          id: string
          organisation_id: string
          request_note: string | null
          requested_at: string
          requested_by: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_id: string
          request_note?: string | null
          requested_at?: string
          requested_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organisation_id?: string
          request_note?: string | null
          requested_at?: string
          requested_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wo_close_approvals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wo_close_approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wo_close_approvals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wo_close_approvals_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wo_loto_checklists: {
        Row: {
          affected_notified_at: string | null
          authorized_by: string | null
          created_at: string
          created_by: string | null
          id: string
          locks_removed_at: string | null
          organisation_id: string
          restored_at: string | null
          shutdown_at: string | null
          status: string
          stored_energy_released_at: string | null
          verified_by: string | null
          verified_zero_energy_at: string | null
          work_order_id: string
        }
        Insert: {
          affected_notified_at?: string | null
          authorized_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          locks_removed_at?: string | null
          organisation_id: string
          restored_at?: string | null
          shutdown_at?: string | null
          status?: string
          stored_energy_released_at?: string | null
          verified_by?: string | null
          verified_zero_energy_at?: string | null
          work_order_id: string
        }
        Update: {
          affected_notified_at?: string | null
          authorized_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          locks_removed_at?: string | null
          organisation_id?: string
          restored_at?: string | null
          shutdown_at?: string | null
          status?: string
          stored_energy_released_at?: string | null
          verified_by?: string | null
          verified_zero_energy_at?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wo_loto_checklists_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wo_loto_checklists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wo_loto_checklists_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wo_loto_checklists_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wo_loto_checklists_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wo_loto_energy_sources: {
        Row: {
          checklist_id: string
          energy_type: string
          id: string
          isolated: boolean
          isolated_at: string | null
          isolated_by: string | null
          lock_id: string | null
          tag_id: string | null
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          checklist_id: string
          energy_type: string
          id?: string
          isolated?: boolean
          isolated_at?: string | null
          isolated_by?: string | null
          lock_id?: string | null
          tag_id?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          checklist_id?: string
          energy_type?: string
          id?: string
          isolated?: boolean
          isolated_at?: string | null
          isolated_by?: string | null
          lock_id?: string | null
          tag_id?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wo_loto_energy_sources_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "wo_loto_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wo_loto_energy_sources_isolated_by_fkey"
            columns: ["isolated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wo_loto_energy_sources_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wo_safety_approvals: {
        Row: {
          created_at: string
          id: string
          organisation_id: string
          request_note: string | null
          requested_at: string
          requested_by: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_id: string
          request_note?: string | null
          requested_at?: string
          requested_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organisation_id?: string
          request_note?: string | null
          requested_at?: string
          requested_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wo_safety_approvals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wo_safety_approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wo_safety_approvals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wo_safety_approvals_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wo_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: string | null
          id: string
          note: string | null
          organisation_id: string
          to_status: string
          work_order_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          organisation_id: string
          to_status: string
          work_order_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          organisation_id?: string
          to_status?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wo_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wo_status_history_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wo_status_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_tasks: {
        Row: {
          created_at: string
          created_by: string | null
          done_at: string | null
          done_by: string | null
          id: string
          is_done: boolean
          label: string
          notes: string | null
          organisation_id: string
          position: number
          source: string
          source_id: string | null
          updated_at: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          label: string
          notes?: string | null
          organisation_id: string
          position?: number
          source?: string
          source_id?: string | null
          updated_at?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          label?: string
          notes?: string | null
          organisation_id?: string
          position?: number
          source?: string
          source_id?: string | null
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_tasks_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          accepted_at: string | null
          accepted_by_name: string | null
          actual_work_done: string | null
          assignee_id: string | null
          checklist_template_id: string | null
          comeback_notes: string | null
          completed_at: string | null
          contractor_id: string | null
          cost_currency: string | null
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          due_date: string | null
          equipment_label: string | null
          finished_at: string | null
          had_comeback: boolean
          handed_over_at: string | null
          handed_over_by_name: string | null
          id: string
          inspected_at: string | null
          inspected_by_name: string | null
          is_outsourced: boolean
          labor_cost: number | null
          machine_id: string
          model_no: string | null
          nature_of_problem: string | null
          organisation_id: string
          permit_cold_work: boolean
          permit_confined_space: boolean
          permit_hot_work: boolean
          permit_isolation: boolean
          permit_jsea: boolean
          plant_area: string | null
          priority: string
          promised_date: string | null
          proposed_remedy: string | null
          remarks: string | null
          requested_by_name: string | null
          returned_date: string | null
          schedule_id: string | null
          sent_date: string | null
          serial_no: string | null
          service_log_id: string | null
          started_at: string | null
          status: string
          technician_comment: string | null
          time_received: string | null
          title: string
          updated_at: string
          vendor_cost: number | null
          vendor_currency: string | null
          vendor_id: string | null
          warranty_days: number | null
          warranty_notes: string | null
          wo_number: number | null
          wo_year: number | null
          work_type: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_name?: string | null
          actual_work_done?: string | null
          assignee_id?: string | null
          checklist_template_id?: string | null
          comeback_notes?: string | null
          completed_at?: string | null
          contractor_id?: string | null
          cost_currency?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          due_date?: string | null
          equipment_label?: string | null
          finished_at?: string | null
          had_comeback?: boolean
          handed_over_at?: string | null
          handed_over_by_name?: string | null
          id?: string
          inspected_at?: string | null
          inspected_by_name?: string | null
          is_outsourced?: boolean
          labor_cost?: number | null
          machine_id: string
          model_no?: string | null
          nature_of_problem?: string | null
          organisation_id: string
          permit_cold_work?: boolean
          permit_confined_space?: boolean
          permit_hot_work?: boolean
          permit_isolation?: boolean
          permit_jsea?: boolean
          plant_area?: string | null
          priority?: string
          promised_date?: string | null
          proposed_remedy?: string | null
          remarks?: string | null
          requested_by_name?: string | null
          returned_date?: string | null
          schedule_id?: string | null
          sent_date?: string | null
          serial_no?: string | null
          service_log_id?: string | null
          started_at?: string | null
          status?: string
          technician_comment?: string | null
          time_received?: string | null
          title: string
          updated_at?: string
          vendor_cost?: number | null
          vendor_currency?: string | null
          vendor_id?: string | null
          warranty_days?: number | null
          warranty_notes?: string | null
          wo_number?: number | null
          wo_year?: number | null
          work_type?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_name?: string | null
          actual_work_done?: string | null
          assignee_id?: string | null
          checklist_template_id?: string | null
          comeback_notes?: string | null
          completed_at?: string | null
          contractor_id?: string | null
          cost_currency?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          due_date?: string | null
          equipment_label?: string | null
          finished_at?: string | null
          had_comeback?: boolean
          handed_over_at?: string | null
          handed_over_by_name?: string | null
          id?: string
          inspected_at?: string | null
          inspected_by_name?: string | null
          is_outsourced?: boolean
          labor_cost?: number | null
          machine_id?: string
          model_no?: string | null
          nature_of_problem?: string | null
          organisation_id?: string
          permit_cold_work?: boolean
          permit_confined_space?: boolean
          permit_hot_work?: boolean
          permit_isolation?: boolean
          permit_jsea?: boolean
          plant_area?: string | null
          priority?: string
          promised_date?: string | null
          proposed_remedy?: string | null
          remarks?: string | null
          requested_by_name?: string | null
          returned_date?: string | null
          schedule_id?: string | null
          sent_date?: string | null
          serial_no?: string | null
          service_log_id?: string | null
          started_at?: string | null
          status?: string
          technician_comment?: string | null
          time_received?: string | null
          title?: string
          updated_at?: string
          vendor_cost?: number | null
          vendor_currency?: string | null
          vendor_id?: string | null
          warranty_days?: number | null
          warranty_notes?: string | null
          wo_number?: number | null
          wo_year?: number | null
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_stock_count: { Args: { _count_id: string }; Returns: undefined }
      can_approve_purchase: {
        Args: { _amount: number; _org: string }
        Returns: boolean
      }
      can_author_templates: { Args: { _org_id: string }; Returns: boolean }
      can_close_wo: { Args: { _org: string }; Returns: boolean }
      can_manage: { Args: { _org_id: string }; Returns: boolean }
      can_review_safety: { Args: { _org: string }; Returns: boolean }
      can_submit_fleet_inspection: {
        Args: { _machine_id: string; _org_id: string; _template_id: string }
        Returns: boolean
      }
      can_submit_fleet_inspection_response: {
        Args: { _execution_id: string }
        Returns: boolean
      }
      can_write: { Args: { _org_id: string }; Returns: boolean }
      close_material_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      consume_production_materials: {
        Args: {
          _delta_units: number
          _kpi_id: string
          _machine_id: string
          _org: string
          _product_id: string
        }
        Returns: undefined
      }
      contractor_in_org: { Args: { _id: string }; Returns: boolean }
      controlled_tool_in_org: { Args: { _id: string }; Returns: boolean }
      convert_purchase_request_to_po: {
        Args: {
          _delivery_date?: string
          _payment_terms?: string
          _pr_id: string
          _supplier_id: string
        }
        Returns: string
      }
      current_org_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      garage_estimate_in_org: { Args: { _id: string }; Returns: boolean }
      garage_invoice_in_org: { Args: { _id: string }; Returns: boolean }
      garage_job_in_org: { Args: { _id: string }; Returns: boolean }
      generate_garage_invoice: {
        Args: { _job_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          discount: number
          estimate_id: string | null
          id: string
          invoice_number: number | null
          invoice_year: number | null
          issued_at: string
          job_id: string
          labour_cost: number
          notes: string | null
          organisation_id: string
          other_cost: number
        }
        SetofOptions: {
          from: "*"
          to: "garage_invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_fleet_pre_start_template: {
        Args: { _machine_id: string }
        Returns: {
          item_id: string
          item_severity: string
          item_sort_order: number
          item_text: string
          template_id: string
          template_name: string
          template_version: number
        }[]
      }
      get_inductees_for_programme_public: {
        Args: { _programme_id: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      get_induction_modules_public: {
        Args: { _programme_id: string }
        Returns: {
          content_text: string
          content_type: string
          document_url: string
          has_quiz: boolean
          id: string
          order_index: number
          title: string
          video_url: string
        }[]
      }
      get_induction_programme_public: {
        Args: { _programme_id: string }
        Returns: {
          description: string
          id: string
          name: string
          pass_mark_percent: number
        }[]
      }
      get_induction_quiz_questions_public: {
        Args: { _module_id: string }
        Returns: {
          id: string
          options: Json
          order_index: number
          question_text: string
          question_type: string
        }[]
      }
      get_machine_public: {
        Args: { _machine_id: string }
        Returns: {
          category: string
          cover_image_url: string
          current_hours: number
          id: string
          last_service_date: string
          make: string
          model: string
          name: string
          organisation_id: string
          organisation_name: string
          plate_number: string
          registration_number: string
          serial_number: string
          status: string
          year: number
        }[]
      }
      get_my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_org_active_drivers_public: {
        Args: { _machine_id: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      goods_receipt_in_org: { Args: { _id: string }; Returns: boolean }
      has_department_access: { Args: { _department: string }; Returns: boolean }
      has_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      issue_material_request_item: {
        Args: {
          _machine_id?: string
          _quantity: number
          _request_item_id: string
          _work_order_id?: string
        }
        Returns: undefined
      }
      log_in_org: { Args: { _log_id: string }; Returns: boolean }
      loto_checklist_in_org: { Args: { _id: string }; Returns: boolean }
      machine_in_org: { Args: { _machine_id: string }; Returns: boolean }
      material_request_in_org: { Args: { _id: string }; Returns: boolean }
      module_in_org: { Args: { _module_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      populate_wo_tasks_from_pm: { Args: { _wo_id: string }; Returns: number }
      programme_in_org: { Args: { _programme_id: string }; Returns: boolean }
      purchase_order_in_org: { Args: { _id: string }; Returns: boolean }
      purchase_request_in_org: { Args: { _id: string }; Returns: boolean }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recompute_oee_for_shift: {
        Args: { _date: string; _machine: string; _org: string; _shift: string }
        Returns: undefined
      }
      record_garage_purchase: {
        Args: { _items: Json; _received?: boolean; _supplier_id: string }
        Returns: string
      }
      record_goods_receipt: {
        Args: {
          _items: Json
          _location_id: string
          _notes?: string
          _po_id: string
        }
        Returns: string
      }
      record_in_org: { Args: { _record_id: string }; Returns: boolean }
      record_stock_transaction: {
        Args: {
          _allow_negative?: boolean
          _balance_field?: string
          _item_id: string
          _location_id: string
          _machine_id?: string
          _quantity: number
          _reason?: string
          _reference?: string
          _transaction_type: string
          _work_order_id?: string
        }
        Returns: {
          balance_after: number | null
          balance_field: string
          created_at: string
          id: string
          item_id: string
          location_id: string | null
          machine_id: string | null
          organisation_id: string
          performed_by: string | null
          quantity: number
          reason: string | null
          reference: string | null
          to_location_id: string | null
          transaction_type: string
          work_order_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "stock_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_quarantine_item: {
        Args: { _decision: string; _goods_receipt_item_id: string }
        Returns: undefined
      }
      return_material_request_item: {
        Args: {
          _condition: string
          _quantity: number
          _reason?: string
          _request_item_id: string
        }
        Returns: undefined
      }
      review_material_request: {
        Args: {
          _decision: string
          _item_approvals?: Json
          _request_id: string
          _review_note?: string
        }
        Returns: undefined
      }
      review_purchase_order: {
        Args: { _decision: string; _po_id: string }
        Returns: undefined
      }
      review_purchase_request: {
        Args: { _decision: string; _pr_id: string; _review_note?: string }
        Returns: undefined
      }
      risk_assessment_in_org: { Args: { _id: string }; Returns: boolean }
      set_user_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      start_induction_public: {
        Args: { _inductee_id: string; _programme_id: string }
        Returns: string
      }
      stock_count_in_org: { Args: { _id: string }; Returns: boolean }
      submit_induction_quiz_public: {
        Args: { _answers: Json; _module_id: string; _record_id: string }
        Returns: {
          passed: boolean
          score_percent: number
        }[]
      }
      transfer_stock: {
        Args: {
          _from_location_id: string
          _item_id: string
          _quantity: number
          _reason?: string
          _reference?: string
          _to_location_id: string
        }
        Returns: {
          balance_after: number | null
          balance_field: string
          created_at: string
          id: string
          item_id: string
          location_id: string | null
          machine_id: string | null
          organisation_id: string
          performed_by: string | null
          quantity: number
          reason: string | null
          reference: string | null
          to_location_id: string | null
          transaction_type: string
          work_order_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "stock_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_wo: {
        Args: { _note?: string; _to: string; _wo_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "technician" | "viewer" | "engineer"
      industry_profile: "manufacturing" | "fleet_logistics" | "garage" | "mixed"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["owner", "manager", "technician", "viewer", "engineer"],
      industry_profile: ["manufacturing", "fleet_logistics", "garage", "mixed"],
    },
  },
} as const

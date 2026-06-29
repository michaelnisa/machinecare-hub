export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      checklist_completions: {
        Row: {
          checklist_item_id: string;
          completed_at: string;
          completed_by: string | null;
          completed_by_name: string | null;
          hours_at_completion: number | null;
          id: string;
          machine_id: string;
          notes: string | null;
          service_log_id: string | null;
        };
        Insert: {
          checklist_item_id: string;
          completed_at?: string;
          completed_by?: string | null;
          completed_by_name?: string | null;
          hours_at_completion?: number | null;
          id?: string;
          machine_id: string;
          notes?: string | null;
          service_log_id?: string | null;
        };
        Update: {
          checklist_item_id?: string;
          completed_at?: string;
          completed_by?: string | null;
          completed_by_name?: string | null;
          hours_at_completion?: number | null;
          id?: string;
          machine_id?: string;
          notes?: string | null;
          service_log_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "checklist_completions_checklist_item_id_fkey";
            columns: ["checklist_item_id"];
            isOneToOne: false;
            referencedRelation: "machine_checklist_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checklist_completions_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checklist_completions_service_log_id_fkey";
            columns: ["service_log_id"];
            isOneToOne: false;
            referencedRelation: "service_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      checklist_execution_responses: {
        Row: {
          created_at: string;
          execution_id: string;
          id: string;
          item_id: string | null;
          item_text_snapshot: string;
          item_type: string;
          measured_value: number | null;
          notes: string | null;
          photo_url: string | null;
          result: string | null;
          severity_snapshot: string;
          sort_order: number;
          text_response: string | null;
          work_order_id: string | null;
        };
        Insert: {
          created_at?: string;
          execution_id: string;
          id?: string;
          item_id?: string | null;
          item_text_snapshot: string;
          item_type?: string;
          measured_value?: number | null;
          notes?: string | null;
          photo_url?: string | null;
          result?: string | null;
          severity_snapshot?: string;
          sort_order?: number;
          text_response?: string | null;
          work_order_id?: string | null;
        };
        Update: {
          created_at?: string;
          execution_id?: string;
          id?: string;
          item_id?: string | null;
          item_text_snapshot?: string;
          item_type?: string;
          measured_value?: number | null;
          notes?: string | null;
          photo_url?: string | null;
          result?: string | null;
          severity_snapshot?: string;
          sort_order?: number;
          text_response?: string | null;
          work_order_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "checklist_execution_responses_execution_id_fkey";
            columns: ["execution_id"];
            isOneToOne: false;
            referencedRelation: "checklist_executions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checklist_execution_responses_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "checklist_template_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checklist_execution_responses_work_order_id_fkey";
            columns: ["work_order_id"];
            isOneToOne: false;
            referencedRelation: "work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      checklist_executions: {
        Row: {
          created_at: string;
          hours_at_execution: number | null;
          id: string;
          machine_id: string;
          notes: string | null;
          organisation_id: string;
          performed_at: string;
          performed_by: string | null;
          performed_by_name: string | null;
          status: string;
          template_id: string;
          template_version: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          hours_at_execution?: number | null;
          id?: string;
          machine_id: string;
          notes?: string | null;
          organisation_id: string;
          performed_at?: string;
          performed_by?: string | null;
          performed_by_name?: string | null;
          status?: string;
          template_id: string;
          template_version?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          hours_at_execution?: number | null;
          id?: string;
          machine_id?: string;
          notes?: string | null;
          organisation_id?: string;
          performed_at?: string;
          performed_by?: string | null;
          performed_by_name?: string | null;
          status?: string;
          template_id?: string;
          template_version?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checklist_executions_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checklist_executions_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checklist_executions_performed_by_fkey";
            columns: ["performed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checklist_executions_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "checklist_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      checklist_template_items: {
        Row: {
          created_at: string;
          id: string;
          item_type: string;
          max_value: number | null;
          min_value: number | null;
          severity: string;
          sort_order: number;
          template_id: string;
          text: string;
          unit: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          item_type?: string;
          max_value?: number | null;
          min_value?: number | null;
          severity?: string;
          sort_order?: number;
          template_id: string;
          text: string;
          unit?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_type?: string;
          max_value?: number | null;
          min_value?: number | null;
          severity?: string;
          sort_order?: number;
          template_id?: string;
          text?: string;
          unit?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "checklist_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      checklist_templates: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          machine_category: string | null;
          machine_id: string | null;
          name: string;
          organisation_id: string;
          parent_template_id: string | null;
          status: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          machine_category?: string | null;
          machine_id?: string | null;
          name: string;
          organisation_id: string;
          parent_template_id?: string | null;
          status?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          machine_category?: string | null;
          machine_id?: string | null;
          name?: string;
          organisation_id?: string;
          parent_template_id?: string | null;
          status?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "checklist_templates_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checklist_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checklist_templates_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checklist_templates_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checklist_templates_parent_template_id_fkey";
            columns: ["parent_template_id"];
            isOneToOne: false;
            referencedRelation: "checklist_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          doc_category: string | null;
          expires_on: string | null;
          file_type: string | null;
          file_url: string;
          id: string;
          issued_on: string | null;
          issuer: string | null;
          machine_id: string;
          name: string;
          reminder_days: number;
          service_log_id: string | null;
          uploaded_at: string;
        };
        Insert: {
          doc_category?: string | null;
          expires_on?: string | null;
          file_type?: string | null;
          file_url: string;
          id?: string;
          issued_on?: string | null;
          issuer?: string | null;
          machine_id: string;
          name: string;
          reminder_days?: number;
          service_log_id?: string | null;
          uploaded_at?: string;
        };
        Update: {
          doc_category?: string | null;
          expires_on?: string | null;
          file_type?: string | null;
          file_url?: string;
          id?: string;
          issued_on?: string | null;
          issuer?: string | null;
          machine_id?: string;
          name?: string;
          reminder_days?: number;
          service_log_id?: string | null;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_service_log_id_fkey";
            columns: ["service_log_id"];
            isOneToOne: false;
            referencedRelation: "service_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      email_send_log: {
        Row: {
          created_at: string;
          error_message: string | null;
          id: string;
          message_id: string | null;
          metadata: Json | null;
          recipient_email: string;
          status: string;
          template_name: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          message_id?: string | null;
          metadata?: Json | null;
          recipient_email: string;
          status: string;
          template_name: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          message_id?: string | null;
          metadata?: Json | null;
          recipient_email?: string;
          status?: string;
          template_name?: string;
        };
        Relationships: [];
      };
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number;
          batch_size: number;
          id: number;
          retry_after_until: string | null;
          send_delay_ms: number;
          transactional_email_ttl_minutes: number;
          updated_at: string;
        };
        Insert: {
          auth_email_ttl_minutes?: number;
          batch_size?: number;
          id?: number;
          retry_after_until?: string | null;
          send_delay_ms?: number;
          transactional_email_ttl_minutes?: number;
          updated_at?: string;
        };
        Update: {
          auth_email_ttl_minutes?: number;
          batch_size?: number;
          id?: number;
          retry_after_until?: string | null;
          send_delay_ms?: number;
          transactional_email_ttl_minutes?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_unsubscribe_tokens: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          token: string;
          used_at: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          token: string;
          used_at?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          token?: string;
          used_at?: string | null;
        };
        Relationships: [];
      };
      fault_reports: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          machine_id: string;
          organisation_id: string;
          reporter_name: string;
          reporter_phone: string;
          status: string;
          updated_at: string;
          work_order_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description: string;
          id?: string;
          machine_id: string;
          organisation_id: string;
          reporter_name: string;
          reporter_phone: string;
          status?: string;
          updated_at?: string;
          work_order_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          machine_id?: string;
          organisation_id?: string;
          reporter_name?: string;
          reporter_phone?: string;
          status?: string;
          updated_at?: string;
          work_order_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fault_reports_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fault_reports_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fault_reports_work_order_id_fkey";
            columns: ["work_order_id"];
            isOneToOne: false;
            referencedRelation: "work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      fuel_logs: {
        Row: {
          created_at: string;
          created_by: string | null;
          currency: string | null;
          fuel_cost: number;
          fuel_litres: number | null;
          id: string;
          machine_id: string;
          notes: string | null;
          odometer: number | null;
          recorded_at: string;
          station: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          currency?: string | null;
          fuel_cost?: number;
          fuel_litres?: number | null;
          id?: string;
          machine_id: string;
          notes?: string | null;
          odometer?: number | null;
          recorded_at?: string;
          station?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          currency?: string | null;
          fuel_cost?: number;
          fuel_litres?: number | null;
          id?: string;
          machine_id?: string;
          notes?: string | null;
          odometer?: number | null;
          recorded_at?: string;
          station?: string | null;
        };
        Relationships: [];
      };
      inductees: {
        Row: {
          company: string | null;
          created_at: string;
          created_by: string | null;
          department: string | null;
          email: string | null;
          full_name: string;
          id: string;
          id_number: string | null;
          inductee_type: string;
          organisation_id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          company?: string | null;
          created_at?: string;
          created_by?: string | null;
          department?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          id_number?: string | null;
          inductee_type?: string;
          organisation_id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          company?: string | null;
          created_at?: string;
          created_by?: string | null;
          department?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          id_number?: string | null;
          inductee_type?: string;
          organisation_id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      induction_module_results: {
        Row: {
          answers_given: Json;
          attempts: number;
          completed_at: string;
          id: string;
          induction_record_id: string;
          module_id: string;
          passed: boolean;
          score_percent: number;
        };
        Insert: {
          answers_given?: Json;
          attempts?: number;
          completed_at?: string;
          id?: string;
          induction_record_id: string;
          module_id: string;
          passed?: boolean;
          score_percent?: number;
        };
        Update: {
          answers_given?: Json;
          attempts?: number;
          completed_at?: string;
          id?: string;
          induction_record_id?: string;
          module_id?: string;
          passed?: boolean;
          score_percent?: number;
        };
        Relationships: [];
      };
      induction_modules: {
        Row: {
          content_text: string | null;
          content_type: string;
          created_at: string;
          document_url: string | null;
          has_quiz: boolean;
          id: string;
          order_index: number;
          programme_id: string;
          title: string;
          updated_at: string;
          video_url: string | null;
        };
        Insert: {
          content_text?: string | null;
          content_type?: string;
          created_at?: string;
          document_url?: string | null;
          has_quiz?: boolean;
          id?: string;
          order_index?: number;
          programme_id: string;
          title: string;
          updated_at?: string;
          video_url?: string | null;
        };
        Update: {
          content_text?: string | null;
          content_type?: string;
          created_at?: string;
          document_url?: string | null;
          has_quiz?: boolean;
          id?: string;
          order_index?: number;
          programme_id?: string;
          title?: string;
          updated_at?: string;
          video_url?: string | null;
        };
        Relationships: [];
      };
      induction_programmes: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          inductee_type: string;
          is_active: boolean;
          name: string;
          organisation_id: string;
          pass_mark_percent: number;
          updated_at: string;
          validity_days: number | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          inductee_type?: string;
          is_active?: boolean;
          name: string;
          organisation_id: string;
          pass_mark_percent?: number;
          updated_at?: string;
          validity_days?: number | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          inductee_type?: string;
          is_active?: boolean;
          name?: string;
          organisation_id?: string;
          pass_mark_percent?: number;
          updated_at?: string;
          validity_days?: number | null;
        };
        Relationships: [];
      };
      induction_quiz_questions: {
        Row: {
          correct_answer: string;
          created_at: string;
          id: string;
          module_id: string;
          options: Json;
          order_index: number;
          question_text: string;
          question_type: string;
        };
        Insert: {
          correct_answer: string;
          created_at?: string;
          id?: string;
          module_id: string;
          options?: Json;
          order_index?: number;
          question_text: string;
          question_type?: string;
        };
        Update: {
          correct_answer?: string;
          created_at?: string;
          id?: string;
          module_id?: string;
          options?: Json;
          order_index?: number;
          question_text?: string;
          question_type?: string;
        };
        Relationships: [];
      };
      induction_records: {
        Row: {
          completed_at: string | null;
          created_at: string;
          digital_signature_url: string | null;
          expires_at: string | null;
          id: string;
          inducted_by: string | null;
          inductee_id: string;
          organisation_id: string;
          overall_score_percent: number | null;
          programme_id: string;
          started_at: string;
          status: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          digital_signature_url?: string | null;
          expires_at?: string | null;
          id?: string;
          inducted_by?: string | null;
          inductee_id: string;
          organisation_id: string;
          overall_score_percent?: number | null;
          programme_id: string;
          started_at?: string;
          status?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          digital_signature_url?: string | null;
          expires_at?: string | null;
          id?: string;
          inducted_by?: string | null;
          inductee_id?: string;
          organisation_id?: string;
          overall_score_percent?: number | null;
          programme_id?: string;
          started_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      induction_reminders: {
        Row: {
          channel: string;
          id: string;
          induction_record_id: string;
          organisation_id: string;
          reminded_at: string;
          reminded_by: string | null;
        };
        Insert: {
          channel?: string;
          id?: string;
          induction_record_id: string;
          organisation_id: string;
          reminded_at?: string;
          reminded_by?: string | null;
        };
        Update: {
          channel?: string;
          id?: string;
          induction_record_id?: string;
          organisation_id?: string;
          reminded_at?: string;
          reminded_by?: string | null;
        };
        Relationships: [];
      };
      inventory_items: {
        Row: {
          category: string | null;
          created_at: string;
          id: string;
          last_low_stock_notified_at: string | null;
          location: string | null;
          name: string;
          notes: string | null;
          order_expected_at: string | null;
          order_note: string | null;
          order_status: string;
          ordered_at: string | null;
          organisation_id: string;
          part_number: string | null;
          quantity: number;
          reorder_level: number;
          supplier: string | null;
          unit: string;
          unit_cost: number;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          id?: string;
          last_low_stock_notified_at?: string | null;
          location?: string | null;
          name: string;
          notes?: string | null;
          order_expected_at?: string | null;
          order_note?: string | null;
          order_status?: string;
          ordered_at?: string | null;
          organisation_id: string;
          part_number?: string | null;
          quantity?: number;
          reorder_level?: number;
          supplier?: string | null;
          unit?: string;
          unit_cost?: number;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          id?: string;
          last_low_stock_notified_at?: string | null;
          location?: string | null;
          name?: string;
          notes?: string | null;
          order_expected_at?: string | null;
          order_note?: string | null;
          order_status?: string;
          ordered_at?: string | null;
          organisation_id?: string;
          part_number?: string | null;
          quantity?: number;
          reorder_level?: number;
          supplier?: string | null;
          unit?: string;
          unit_cost?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      knowledge_items: {
        Row: {
          category: string;
          content: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          machine_id: string;
          title: string;
        };
        Insert: {
          category?: string;
          content?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          machine_id: string;
          title: string;
        };
        Update: {
          category?: string;
          content?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          machine_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_items_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
        ];
      };
      machine_checklist_items: {
        Row: {
          applies_to: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          interval_days: number | null;
          interval_hours: number | null;
          machine_id: string;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          applies_to?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          interval_days?: number | null;
          interval_hours?: number | null;
          machine_id: string;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          applies_to?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          interval_days?: number | null;
          interval_hours?: number | null;
          machine_id?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "machine_checklist_items_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
        ];
      };
      machine_pm_parts: {
        Row: {
          checklist_item_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          machine_id: string;
          notes: string | null;
          part_name: string;
          part_number: string | null;
          quantity: number;
          unit: string;
          updated_at: string;
        };
        Insert: {
          checklist_item_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          machine_id: string;
          notes?: string | null;
          part_name: string;
          part_number?: string | null;
          quantity?: number;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          checklist_item_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          machine_id?: string;
          notes?: string | null;
          part_name?: string;
          part_number?: string | null;
          quantity?: number;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      machine_status_history: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          from_status: string | null;
          id: string;
          machine_id: string;
          organisation_id: string;
          reason: string | null;
          to_status: string;
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          from_status?: string | null;
          id?: string;
          machine_id: string;
          organisation_id: string;
          reason?: string | null;
          to_status: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          from_status?: string | null;
          id?: string;
          machine_id?: string;
          organisation_id?: string;
          reason?: string | null;
          to_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "machine_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "machine_status_history_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "machine_status_history_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      machines: {
        Row: {
          category: string;
          cover_image_url: string | null;
          created_at: string;
          current_hours: number | null;
          id: string;
          make: string | null;
          model: string | null;
          name: string;
          notes: string | null;
          organisation_id: string;
          purchase_date: string | null;
          registration_number: string | null;
          serial_number: string | null;
          status: string;
          year: number | null;
        };
        Insert: {
          category: string;
          cover_image_url?: string | null;
          created_at?: string;
          current_hours?: number | null;
          id?: string;
          make?: string | null;
          model?: string | null;
          name: string;
          notes?: string | null;
          organisation_id: string;
          purchase_date?: string | null;
          registration_number?: string | null;
          serial_number?: string | null;
          status?: string;
          year?: number | null;
        };
        Update: {
          category?: string;
          cover_image_url?: string | null;
          created_at?: string;
          current_hours?: number | null;
          id?: string;
          make?: string | null;
          model?: string | null;
          name?: string;
          notes?: string | null;
          organisation_id?: string;
          purchase_date?: string | null;
          registration_number?: string | null;
          serial_number?: string | null;
          status?: string;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "machines_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      maintenance_email_runs: {
        Row: {
          due_soon_count: number;
          emails_sent: number;
          error_message: string | null;
          id: string;
          organisation_id: string;
          overdue_count: number;
          ran_at: string;
          status: string;
        };
        Insert: {
          due_soon_count?: number;
          emails_sent?: number;
          error_message?: string | null;
          id?: string;
          organisation_id: string;
          overdue_count?: number;
          ran_at?: string;
          status?: string;
        };
        Update: {
          due_soon_count?: number;
          emails_sent?: number;
          error_message?: string | null;
          id?: string;
          organisation_id?: string;
          overdue_count?: number;
          ran_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_email_runs_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      maintenance_notifications: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          closed_at: string | null;
          created_at: string;
          description: string | null;
          id: string;
          machine_id: string | null;
          organisation_id: string;
          reported_by: string | null;
          severity: string;
          status: string;
          title: string;
          updated_at: string;
          work_order_id: string | null;
        };
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          closed_at?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          machine_id?: string | null;
          organisation_id: string;
          reported_by?: string | null;
          severity?: string;
          status?: string;
          title: string;
          updated_at?: string;
          work_order_id?: string | null;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          closed_at?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          machine_id?: string | null;
          organisation_id?: string;
          reported_by?: string | null;
          severity?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          work_order_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_notifications_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_notifications_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_notifications_work_order_id_fkey";
            columns: ["work_order_id"];
            isOneToOne: false;
            referencedRelation: "work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      meter_readings: {
        Row: {
          created_at: string;
          id: string;
          machine_id: string;
          notes: string | null;
          organisation_id: string;
          reading: number;
          reading_date: string;
          recorded_by: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          machine_id: string;
          notes?: string | null;
          organisation_id: string;
          reading: number;
          reading_date?: string;
          recorded_by?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          machine_id?: string;
          notes?: string | null;
          organisation_id?: string;
          reading?: number;
          reading_date?: string;
          recorded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "meter_readings_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meter_readings_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meter_readings_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      oee_records: {
        Row: {
          availability: number | null;
          created_at: string;
          created_by: string | null;
          downtime_minutes: number;
          id: string;
          ideal_cycle_seconds: number;
          machine_id: string;
          notes: string | null;
          organisation_id: string;
          performance: number | null;
          planned_minutes: number;
          quality: number | null;
          record_date: string;
          units_good: number;
          units_produced: number;
          updated_at: string;
        };
        Insert: {
          availability?: number | null;
          created_at?: string;
          created_by?: string | null;
          downtime_minutes?: number;
          id?: string;
          ideal_cycle_seconds?: number;
          machine_id: string;
          notes?: string | null;
          organisation_id: string;
          performance?: number | null;
          planned_minutes: number;
          quality?: number | null;
          record_date: string;
          units_good?: number;
          units_produced?: number;
          updated_at?: string;
        };
        Update: {
          availability?: number | null;
          created_at?: string;
          created_by?: string | null;
          downtime_minutes?: number;
          id?: string;
          ideal_cycle_seconds?: number;
          machine_id?: string;
          notes?: string | null;
          organisation_id?: string;
          performance?: number | null;
          planned_minutes?: number;
          quality?: number | null;
          record_date?: string;
          units_good?: number;
          units_produced?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oee_records_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oee_records_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      org_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          organisation_id: string;
          role: Database["public"]["Enums"]["app_role"];
          status: string;
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          organisation_id: string;
          role?: Database["public"]["Enums"]["app_role"];
          status?: string;
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          organisation_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          status?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_invites_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      org_wo_counters: {
        Row: {
          next_number: number;
          organisation_id: string;
          updated_at: string;
          year: number;
        };
        Insert: {
          next_number?: number;
          organisation_id: string;
          updated_at?: string;
          year: number;
        };
        Update: {
          next_number?: number;
          organisation_id?: string;
          updated_at?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "org_wo_counters_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      organisations: {
        Row: {
          created_at: string;
          id: string;
          industry: string | null;
          name: string;
          notifications_enabled: boolean;
          notifications_lead_days: number;
          notifications_notify_engineers: boolean;
          notifications_notify_managers: boolean;
          notifications_notify_technicians: boolean;
          notifications_system_inbox: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          industry?: string | null;
          name: string;
          notifications_enabled?: boolean;
          notifications_lead_days?: number;
          notifications_notify_engineers?: boolean;
          notifications_notify_managers?: boolean;
          notifications_notify_technicians?: boolean;
          notifications_system_inbox?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          industry?: string | null;
          name?: string;
          notifications_enabled?: boolean;
          notifications_lead_days?: number;
          notifications_notify_engineers?: boolean;
          notifications_notify_managers?: boolean;
          notifications_notify_technicians?: boolean;
          notifications_system_inbox?: string | null;
        };
        Relationships: [];
      };
      production_kpis: {
        Row: {
          actual_units: number;
          attainment_percent: number | null;
          created_at: string;
          downtime_minutes: number;
          id: string;
          machine_id: string | null;
          notes: string | null;
          operator: string | null;
          organisation_id: string;
          product: string | null;
          record_date: string;
          scrap_units: number;
          shift: string | null;
          target_units: number;
          updated_at: string;
        };
        Insert: {
          actual_units?: number;
          attainment_percent?: number | null;
          created_at?: string;
          downtime_minutes?: number;
          id?: string;
          machine_id?: string | null;
          notes?: string | null;
          operator?: string | null;
          organisation_id: string;
          product?: string | null;
          record_date?: string;
          scrap_units?: number;
          shift?: string | null;
          target_units?: number;
          updated_at?: string;
        };
        Update: {
          actual_units?: number;
          attainment_percent?: number | null;
          created_at?: string;
          downtime_minutes?: number;
          id?: string;
          machine_id?: string | null;
          notes?: string | null;
          operator?: string | null;
          organisation_id?: string;
          product?: string | null;
          record_date?: string;
          scrap_units?: number;
          shift?: string | null;
          target_units?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_kpis_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_kpis_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          organisation_id: string;
          phone: string | null;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          organisation_id: string;
          phone?: string | null;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          organisation_id?: string;
          phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      quality_reports: {
        Row: {
          corrective_action: string | null;
          created_at: string;
          defect_category: string | null;
          id: string;
          inspector: string | null;
          machine_id: string | null;
          notes: string | null;
          organisation_id: string;
          product: string | null;
          report_date: string;
          root_cause: string | null;
          units_defective: number;
          units_inspected: number;
          units_rework: number;
          units_scrap: number;
          updated_at: string;
          yield_percent: number | null;
        };
        Insert: {
          corrective_action?: string | null;
          created_at?: string;
          defect_category?: string | null;
          id?: string;
          inspector?: string | null;
          machine_id?: string | null;
          notes?: string | null;
          organisation_id: string;
          product?: string | null;
          report_date?: string;
          root_cause?: string | null;
          units_defective?: number;
          units_inspected?: number;
          units_rework?: number;
          units_scrap?: number;
          updated_at?: string;
          yield_percent?: number | null;
        };
        Update: {
          corrective_action?: string | null;
          created_at?: string;
          defect_category?: string | null;
          id?: string;
          inspector?: string | null;
          machine_id?: string | null;
          notes?: string | null;
          organisation_id?: string;
          product?: string | null;
          report_date?: string;
          root_cause?: string | null;
          units_defective?: number;
          units_inspected?: number;
          units_rework?: number;
          units_scrap?: number;
          updated_at?: string;
          yield_percent?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "quality_reports_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quality_reports_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      safety_incidents: {
        Row: {
          closed_at: string | null;
          corrective_action: string | null;
          created_at: string;
          description: string;
          id: string;
          immediate_action: string | null;
          incident_type: string;
          location: string | null;
          lost_time_hours: number | null;
          machine_id: string | null;
          occurred_at: string;
          organisation_id: string;
          persons_involved: string | null;
          reported_by: string | null;
          severity: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          closed_at?: string | null;
          corrective_action?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          immediate_action?: string | null;
          incident_type?: string;
          location?: string | null;
          lost_time_hours?: number | null;
          machine_id?: string | null;
          occurred_at?: string;
          organisation_id: string;
          persons_involved?: string | null;
          reported_by?: string | null;
          severity?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          closed_at?: string | null;
          corrective_action?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          immediate_action?: string | null;
          incident_type?: string;
          location?: string | null;
          lost_time_hours?: number | null;
          machine_id?: string | null;
          occurred_at?: string;
          organisation_id?: string;
          persons_involved?: string | null;
          reported_by?: string | null;
          severity?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "safety_incidents_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "safety_incidents_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      service_logs: {
        Row: {
          cost: number | null;
          created_at: string;
          currency: string | null;
          description: string | null;
          hours_at_service: number | null;
          id: string;
          machine_id: string;
          performed_at: string;
          performed_by: string | null;
          schedule_id: string | null;
          service_type: string;
          status: string;
          title: string;
        };
        Insert: {
          cost?: number | null;
          created_at?: string;
          currency?: string | null;
          description?: string | null;
          hours_at_service?: number | null;
          id?: string;
          machine_id: string;
          performed_at?: string;
          performed_by?: string | null;
          schedule_id?: string | null;
          service_type: string;
          status?: string;
          title: string;
        };
        Update: {
          cost?: number | null;
          created_at?: string;
          currency?: string | null;
          description?: string | null;
          hours_at_service?: number | null;
          id?: string;
          machine_id?: string;
          performed_at?: string;
          performed_by?: string | null;
          schedule_id?: string | null;
          service_type?: string;
          status?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_logs_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_logs_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "service_schedules";
            referencedColumns: ["id"];
          },
        ];
      };
      service_parts: {
        Row: {
          id: string;
          inventory_item_id: string | null;
          notes: string | null;
          part_name: string;
          part_number: string | null;
          part_type: string | null;
          quantity: number | null;
          service_log_id: string;
          supplier: string | null;
          unit: string | null;
          unit_cost: number | null;
        };
        Insert: {
          id?: string;
          inventory_item_id?: string | null;
          notes?: string | null;
          part_name: string;
          part_number?: string | null;
          part_type?: string | null;
          quantity?: number | null;
          service_log_id: string;
          supplier?: string | null;
          unit?: string | null;
          unit_cost?: number | null;
        };
        Update: {
          id?: string;
          inventory_item_id?: string | null;
          notes?: string | null;
          part_name?: string;
          part_number?: string | null;
          part_type?: string | null;
          quantity?: number | null;
          service_log_id?: string;
          supplier?: string | null;
          unit?: string | null;
          unit_cost?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "service_parts_service_log_id_fkey";
            columns: ["service_log_id"];
            isOneToOne: false;
            referencedRelation: "service_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      service_schedules: {
        Row: {
          component: string | null;
          created_at: string;
          id: string;
          instructions: string | null;
          interval_days: number | null;
          interval_hours: number | null;
          last_service_date: string | null;
          last_service_hours: number | null;
          machine_id: string;
          name: string;
          next_due_date: string | null;
          next_due_hours: number | null;
          schedule_label: string | null;
          service_type: string;
          shutdown_required: boolean;
          spares: string | null;
          status: string;
          sub_assembly: string | null;
          trade: string | null;
          work_instruction_no: string | null;
        };
        Insert: {
          component?: string | null;
          created_at?: string;
          id?: string;
          instructions?: string | null;
          interval_days?: number | null;
          interval_hours?: number | null;
          last_service_date?: string | null;
          last_service_hours?: number | null;
          machine_id: string;
          name: string;
          next_due_date?: string | null;
          next_due_hours?: number | null;
          schedule_label?: string | null;
          service_type?: string;
          shutdown_required?: boolean;
          spares?: string | null;
          status?: string;
          sub_assembly?: string | null;
          trade?: string | null;
          work_instruction_no?: string | null;
        };
        Update: {
          component?: string | null;
          created_at?: string;
          id?: string;
          instructions?: string | null;
          interval_days?: number | null;
          interval_hours?: number | null;
          last_service_date?: string | null;
          last_service_hours?: number | null;
          machine_id?: string;
          name?: string;
          next_due_date?: string | null;
          next_due_hours?: number | null;
          schedule_label?: string | null;
          service_type?: string;
          shutdown_required?: boolean;
          spares?: string | null;
          status?: string;
          sub_assembly?: string | null;
          trade?: string | null;
          work_instruction_no?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "service_schedules_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
        ];
      };
      sms_logs: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          message: string;
          organisation_id: string;
          phone: string;
          provider_message_id: string | null;
          recipient_user_id: string | null;
          status: string;
          work_order_id: string | null;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: string;
          message: string;
          organisation_id: string;
          phone: string;
          provider_message_id?: string | null;
          recipient_user_id?: string | null;
          status?: string;
          work_order_id?: string | null;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          message?: string;
          organisation_id?: string;
          phone?: string;
          provider_message_id?: string | null;
          recipient_user_id?: string | null;
          status?: string;
          work_order_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sms_logs_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sms_logs_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sms_logs_work_order_id_fkey";
            columns: ["work_order_id"];
            isOneToOne: false;
            referencedRelation: "work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      suppressed_emails: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          metadata: Json | null;
          reason: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          metadata?: Json | null;
          reason: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          metadata?: Json | null;
          reason?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          organisation_id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organisation_id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organisation_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      utilities_kpis: {
        Row: {
          consumption: number;
          cost: number;
          created_at: string;
          currency: string;
          id: string;
          meter_reading: number | null;
          notes: string | null;
          organisation_id: string;
          record_date: string;
          unit: string;
          updated_at: string;
          utility_type: string;
        };
        Insert: {
          consumption?: number;
          cost?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          meter_reading?: number | null;
          notes?: string | null;
          organisation_id: string;
          record_date?: string;
          unit?: string;
          updated_at?: string;
          utility_type?: string;
        };
        Update: {
          consumption?: number;
          cost?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          meter_reading?: number | null;
          notes?: string | null;
          organisation_id?: string;
          record_date?: string;
          unit?: string;
          updated_at?: string;
          utility_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "utilities_kpis_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      vendors: {
        Row: {
          active: boolean;
          address: string | null;
          category: string | null;
          contact_name: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          organisation_id: string;
          phone: string | null;
          specialties: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          address?: string | null;
          category?: string | null;
          contact_name?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          organisation_id: string;
          phone?: string | null;
          specialties?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          category?: string | null;
          contact_name?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          organisation_id?: string;
          phone?: string | null;
          specialties?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendors_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      wo_status_history: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          from_status: string | null;
          id: string;
          note: string | null;
          organisation_id: string;
          to_status: string;
          work_order_id: string;
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          from_status?: string | null;
          id?: string;
          note?: string | null;
          organisation_id: string;
          to_status: string;
          work_order_id: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          from_status?: string | null;
          id?: string;
          note?: string | null;
          organisation_id?: string;
          to_status?: string;
          work_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wo_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wo_status_history_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wo_status_history_work_order_id_fkey";
            columns: ["work_order_id"];
            isOneToOne: false;
            referencedRelation: "work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      work_order_tasks: {
        Row: {
          created_at: string;
          created_by: string | null;
          done_at: string | null;
          done_by: string | null;
          id: string;
          is_done: boolean;
          label: string;
          notes: string | null;
          organisation_id: string;
          position: number;
          source: string;
          source_id: string | null;
          updated_at: string;
          work_order_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          done_at?: string | null;
          done_by?: string | null;
          id?: string;
          is_done?: boolean;
          label: string;
          notes?: string | null;
          organisation_id: string;
          position?: number;
          source?: string;
          source_id?: string | null;
          updated_at?: string;
          work_order_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          done_at?: string | null;
          done_by?: string | null;
          id?: string;
          is_done?: boolean;
          label?: string;
          notes?: string | null;
          organisation_id?: string;
          position?: number;
          source?: string;
          source_id?: string | null;
          updated_at?: string;
          work_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_order_tasks_work_order_id_fkey";
            columns: ["work_order_id"];
            isOneToOne: false;
            referencedRelation: "work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      work_orders: {
        Row: {
          accepted_at: string | null;
          accepted_by_name: string | null;
          actual_work_done: string | null;
          assignee_id: string | null;
          checklist_template_id: string | null;
          comeback_notes: string | null;
          completed_at: string | null;
          cost_currency: string | null;
          created_at: string;
          created_by: string | null;
          department: string | null;
          description: string | null;
          due_date: string | null;
          equipment_label: string | null;
          finished_at: string | null;
          had_comeback: boolean;
          handed_over_at: string | null;
          handed_over_by_name: string | null;
          id: string;
          inspected_at: string | null;
          inspected_by_name: string | null;
          is_outsourced: boolean;
          labor_cost: number | null;
          machine_id: string;
          model_no: string | null;
          nature_of_problem: string | null;
          organisation_id: string;
          permit_cold_work: boolean;
          permit_confined_space: boolean;
          permit_hot_work: boolean;
          permit_isolation: boolean;
          permit_jsea: boolean;
          plant_area: string | null;
          priority: string;
          promised_date: string | null;
          proposed_remedy: string | null;
          remarks: string | null;
          requested_by_name: string | null;
          returned_date: string | null;
          schedule_id: string | null;
          sent_date: string | null;
          serial_no: string | null;
          service_log_id: string | null;
          started_at: string | null;
          status: string;
          technician_comment: string | null;
          time_received: string | null;
          title: string;
          updated_at: string;
          vendor_cost: number | null;
          vendor_currency: string | null;
          vendor_id: string | null;
          warranty_days: number | null;
          warranty_notes: string | null;
          wo_number: number | null;
          wo_year: number | null;
          work_type: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by_name?: string | null;
          actual_work_done?: string | null;
          assignee_id?: string | null;
          checklist_template_id?: string | null;
          comeback_notes?: string | null;
          completed_at?: string | null;
          cost_currency?: string | null;
          created_at?: string;
          created_by?: string | null;
          department?: string | null;
          description?: string | null;
          due_date?: string | null;
          equipment_label?: string | null;
          finished_at?: string | null;
          had_comeback?: boolean;
          handed_over_at?: string | null;
          handed_over_by_name?: string | null;
          id?: string;
          inspected_at?: string | null;
          inspected_by_name?: string | null;
          is_outsourced?: boolean;
          labor_cost?: number | null;
          machine_id: string;
          model_no?: string | null;
          nature_of_problem?: string | null;
          organisation_id: string;
          permit_cold_work?: boolean;
          permit_confined_space?: boolean;
          permit_hot_work?: boolean;
          permit_isolation?: boolean;
          permit_jsea?: boolean;
          plant_area?: string | null;
          priority?: string;
          promised_date?: string | null;
          proposed_remedy?: string | null;
          remarks?: string | null;
          requested_by_name?: string | null;
          returned_date?: string | null;
          schedule_id?: string | null;
          sent_date?: string | null;
          serial_no?: string | null;
          service_log_id?: string | null;
          started_at?: string | null;
          status?: string;
          technician_comment?: string | null;
          time_received?: string | null;
          title: string;
          updated_at?: string;
          vendor_cost?: number | null;
          vendor_currency?: string | null;
          vendor_id?: string | null;
          warranty_days?: number | null;
          warranty_notes?: string | null;
          wo_number?: number | null;
          wo_year?: number | null;
          work_type?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by_name?: string | null;
          actual_work_done?: string | null;
          assignee_id?: string | null;
          checklist_template_id?: string | null;
          comeback_notes?: string | null;
          completed_at?: string | null;
          cost_currency?: string | null;
          created_at?: string;
          created_by?: string | null;
          department?: string | null;
          description?: string | null;
          due_date?: string | null;
          equipment_label?: string | null;
          finished_at?: string | null;
          had_comeback?: boolean;
          handed_over_at?: string | null;
          handed_over_by_name?: string | null;
          id?: string;
          inspected_at?: string | null;
          inspected_by_name?: string | null;
          is_outsourced?: boolean;
          labor_cost?: number | null;
          machine_id?: string;
          model_no?: string | null;
          nature_of_problem?: string | null;
          organisation_id?: string;
          permit_cold_work?: boolean;
          permit_confined_space?: boolean;
          permit_hot_work?: boolean;
          permit_isolation?: boolean;
          permit_jsea?: boolean;
          plant_area?: string | null;
          priority?: string;
          promised_date?: string | null;
          proposed_remedy?: string | null;
          remarks?: string | null;
          requested_by_name?: string | null;
          returned_date?: string | null;
          schedule_id?: string | null;
          sent_date?: string | null;
          serial_no?: string | null;
          service_log_id?: string | null;
          started_at?: string | null;
          status?: string;
          technician_comment?: string | null;
          time_received?: string | null;
          title?: string;
          updated_at?: string;
          vendor_cost?: number | null;
          vendor_currency?: string | null;
          vendor_id?: string | null;
          warranty_days?: number | null;
          warranty_notes?: string | null;
          wo_number?: number | null;
          wo_year?: number | null;
          work_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_orders_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_orders_checklist_template_id_fkey";
            columns: ["checklist_template_id"];
            isOneToOne: false;
            referencedRelation: "checklist_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_orders_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_orders_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_orders_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_author_templates: { Args: { _org_id: string }; Returns: boolean };
      can_manage: { Args: { _org_id: string }; Returns: boolean };
      can_write: { Args: { _org_id: string }; Returns: boolean };
      current_org_id: { Args: never; Returns: string };
      delete_email: {
        Args: { message_id: number; queue_name: string };
        Returns: boolean;
      };
      enqueue_email: {
        Args: { payload: Json; queue_name: string };
        Returns: number;
      };
      get_machine_public: {
        Args: { _machine_id: string };
        Returns: {
          category: string;
          cover_image_url: string;
          current_hours: number;
          id: string;
          make: string;
          model: string;
          name: string;
          organisation_id: string;
          organisation_name: string;
          registration_number: string;
          serial_number: string;
          status: string;
          year: number;
        }[];
      };
      has_role: {
        Args: {
          _org_id: string;
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_org_member: {
        Args: { _org_id: string; _user_id: string };
        Returns: boolean;
      };
      log_in_org: { Args: { _log_id: string }; Returns: boolean };
      machine_in_org: { Args: { _machine_id: string }; Returns: boolean };
      module_in_org: { Args: { _module_id: string }; Returns: boolean };
      move_to_dlq: {
        Args: {
          dlq_name: string;
          message_id: number;
          payload: Json;
          source_queue: string;
        };
        Returns: number;
      };
      populate_wo_tasks_from_pm: { Args: { _wo_id: string }; Returns: number };
      programme_in_org: { Args: { _programme_id: string }; Returns: boolean };
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number };
        Returns: {
          message: Json;
          msg_id: number;
          read_ct: number;
        }[];
      };
      record_in_org: { Args: { _record_id: string }; Returns: boolean };
      set_user_role: {
        Args: {
          _user_id: string;
          _org_id: string;
          _role: Database["public"]["Enums"]["app_role"];
        };
        Returns: undefined;
      };
      transition_wo: {
        Args: { _note?: string; _to: string; _wo_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "owner" | "manager" | "technician" | "viewer" | "engineer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "manager", "technician", "viewer", "engineer"],
    },
  },
} as const;

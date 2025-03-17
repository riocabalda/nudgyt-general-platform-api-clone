import mongoose, { Document } from 'mongoose';
import { SimulationType } from './simulation.model';
import { ServiceType } from './service.model';
import { ServiceLevelType } from './service-level.model';
export type AgentTranscriptSummaryType = Document & {
  simulation: SimulationType | mongoose.Types.ObjectId;
  service: ServiceType | mongoose.Types.ObjectId;
  service_level: ServiceLevelType | mongoose.Types.ObjectId;
  summary: string;
  is_trial_data: boolean;
};

const AgentTranscriptSummarySchema =
  new mongoose.Schema<AgentTranscriptSummaryType>(
    {
      simulation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'simulation'
      },
      service_level: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'service_level'
      },
      service: { type: mongoose.Schema.Types.ObjectId, ref: 'service' },
      summary: { type: String },
      is_trial_data: { type: Boolean, default: false }
    },
    {
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
    }
  );

const AgentTranscriptSummary = mongoose.model<
  AgentTranscriptSummaryType,
  mongoose.PaginateModel<AgentTranscriptSummaryType>
>('agent_transcript_summary', AgentTranscriptSummarySchema);

export default AgentTranscriptSummary;

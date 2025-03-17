import mongoose, { Schema } from 'mongoose';

const AgentSoftSkillSchema = new Schema({
  simulation_id: { type: mongoose.Types.ObjectId, required: true },
  soft_skills_feedback: String
});

const AgentSoftSkill = mongoose.model(
  'agent_softskill',
  AgentSoftSkillSchema,
  'agent_softskills' // Force collection name as per given sample
);

export default AgentSoftSkill;

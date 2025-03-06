import mongoose, { Schema } from 'mongoose';

const Agent_SoftskillSchema = new Schema({
  simulation_id: { type: mongoose.Types.ObjectId, required: true },
  role: String,
  prompt: String,
  soft_skills_feedback: String
});

const Agent_Softskill = mongoose.model(
  'Agent_Softskill',
  Agent_SoftskillSchema,
  'Agent_Softskills' // Force collection name as per given sample
);

export default Agent_Softskill;

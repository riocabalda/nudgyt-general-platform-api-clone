import htmlParser from 'node-html-parser';
import SubscriptionPlan, {
  SubscriptionPlanCurrency,
  SubscriptionPlanForEnum
} from '../models/subscription-plan.model';

async function insertPublicLearnerPaidPlan() {
  const features_html = [
    '<p>Unlimited access to <strong>all Public Basic services</strong> on the platform</p>',
    '<p>User support</p>'
  ];
  const features = features_html.map(
    (html) => htmlParser.parse(html).textContent
  );

  await SubscriptionPlan.findOneAndUpdate(
    {
      name: 'Public',
      subscription_plan_for: SubscriptionPlanForEnum.PUBLIC_LEARNER
    },
    {
      name: 'Public',
      description: 'Paid plan for public learners',
      subscription_plan_for: SubscriptionPlanForEnum.PUBLIC_LEARNER,
      price: 30,
      currency: SubscriptionPlanCurrency.SGD,
      is_active: true,
      details: '',
      features,
      features_html
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function insertPublicLearnerTrialPlan() {
  const features_html = [
    '<p>Access to platform for only <strong>2 weeks from sign up</strong></p>',
    '<p>Unlimited access to <strong>all Public Basic services</strong> on the platform</p>',
    '<p>User support</p>'
  ];
  const features = features_html.map(
    (html) => htmlParser.parse(html).textContent
  );

  await SubscriptionPlan.findOneAndUpdate(
    {
      name: 'Public (Trial)',
      subscription_plan_for: SubscriptionPlanForEnum.PUBLIC_LEARNER
    },
    {
      name: 'Public (Trial)',
      description: 'Trial plan for public learners',
      subscription_plan_for: SubscriptionPlanForEnum.PUBLIC_LEARNER,
      price: 0,
      currency: SubscriptionPlanCurrency.SGD,
      is_active: true,
      details: '',
      features,
      features_html
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function insertPublicTrainerPlan() {
  const features_html = [
    '<p>Unlimited creation of <strong>Draft services</strong></p>',
    '<p><strong>3 Public Basic services</strong></p>',
    '<p>User support</p>'
  ];
  const features = features_html.map(
    (html) => htmlParser.parse(html).textContent
  );

  await SubscriptionPlan.findOneAndUpdate(
    {
      name: 'Public',
      subscription_plan_for: SubscriptionPlanForEnum.PUBLIC_TRAINER
    },
    {
      name: 'Public',
      description: 'Plan for public trainers',
      subscription_plan_for: SubscriptionPlanForEnum.PUBLIC_TRAINER,
      price: 0,
      currency: SubscriptionPlanCurrency.SGD,
      is_active: true,
      details: '',
      features,
      features_html
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function insertBasicPlan() {
  const features_html = [
    '<p><strong>60 active learner seats</strong></p><ul><li>$30 for each additional seat</li></ul>',
    '<p>Unlimited access to <strong>all Public Basic services</strong> on the platform for learners</p>',
    '<p>Unlimited access to <strong>all Private Basic services</strong> on the platform for learners</p>',
    '<p>Unlimited creation of <strong>Private Basic services</strong> for trainers</p>',
    '<p>Admin panel for <strong>accessing and managing users</strong> in your Organization</p>',
    '<p>User support</p>'
  ];
  const features = features_html.map(
    (html) => htmlParser.parse(html).textContent
  );

  await SubscriptionPlan.findOneAndUpdate(
    {
      name: 'Basic',
      subscription_plan_for: SubscriptionPlanForEnum.ORGANIZATION
    },
    {
      name: 'Basic',
      description: 'Basic subscription plan for organizations',
      subscription_plan_for: SubscriptionPlanForEnum.ORGANIZATION,
      price: 1_500,
      currency: SubscriptionPlanCurrency.SGD,
      max_learners: 60,
      extra_learner_price: 30,
      is_active: true,
      details: '',
      features,
      features_html
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function seedSubscriptionPlan() {
  try {
    console.log('Seeding Subscription Plan...');

    await Promise.all([
      insertPublicLearnerPaidPlan(),
      insertPublicLearnerTrialPlan(),
      insertPublicTrainerPlan(),
      insertBasicPlan()
    ]);

    console.log('Subscription Plan seeded.');
  } catch (error) {
    throw new Error(`Error seeding Subscription Plan: ${error}`);
  }
}

export default seedSubscriptionPlan;

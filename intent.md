# Project Intent: LLM Gateway

## What is This Project About?

We are building a **subscription-based gateway that gives users access to the best AI models without locking them into any single platform or tool**.

Today, if you buy a Cursor subscription, you can only use it in Cursor. If you buy a Claude subscription from Anthropic, you can only use it in their ecosystem. We want to break that lock-in and let users bring their subscription **anywhere they want** - whether it's Zed, OpenCode, or any developer tool that integrates with us.

---

## The Problem We're Solving

### The User's Pain Point

Imagine you're a software developer:
- You buy a $200/month subscription for access to the best AI models
- Tomorrow, a new, more powerful model launches from a different provider
- You want to use it, but you can't—you're locked into your original subscription's ecosystem
- You end up buying **another** subscription just to access the new model

This wastes money and fragments the user experience across tools.

### The Developer's Pain Point

If you're building an AI-powered application (like an IDE plugin or a new coding tool):
- Users say: "Can I use my existing subscription from [other platform]?"
- You can't say yes—each tool needs its own subscription system
- Your users are frustrated because they have to pay multiple times

---

## Our Solution: A Unified Gateway

We're creating a **neutral hub** where:

1. **Users buy once** - Get a monthly subscription ($20, $60, or $200)
2. **Users get access to everything** - All frontier-level AI models (Claude, GPT, Grok, etc.) bundled in one subscription
3. **Users use anywhere** - Integrate the gateway into their existing IDE, tools, or bring it to third-party apps
4. **Users control spending** - A credit system lets them choose which models to use without worrying about overspending

---

## Where Are We Right Now?

- **Foundation built**: Basic Next.js + WorkOS authentication setup
- **LLM providers integrated**: We've already tested Grok, GROQ, and Cerebrus (integration in separate codebase)
- **At a crossroads**: We need to decide on core infrastructure for payments, database, and subscription management

---

## What We're Building: The Three Layers

### **Layer 1: User Experience (Dashboard & Integration)**

**The Dashboard** - Where users manage everything
- Sign up and select their subscription tier
- View their remaining credit balance (simple percentage bar, not overwhelming details)
- Generate and manage API keys for their tools
- See which third-party apps have access to their subscription
- Enable/disable "pay-as-you-go" if they want to spend beyond their monthly limit

**Two Ways to Use**
1. **Direct IDE Integration** - Paste an API key into Zed, OpenCode, or their IDE of choice and start using AI models
2. **Sign in with Us** - Third-party developers can add a "Sign in with [Our Gateway]" button so users bring their existing subscription to new apps

### **Layer 2: Authentication & Subscription Management**

**Authentication** - Who is this user?
- Using WorkOS to handle user registration and login
- WorkOS also provides OAuth capabilities so third-party developers can create OAuth applications
- Users can authorize multiple third-party apps to access their subscription

**Subscription Management** - Handling payments
- We're deciding between **Dodo Payments** and **Paddle**
- Key requirement: Must support India (where we're based) and UPI payments
- **Early decision: Dodo Payments** looks like the winner - explicitly supports UPI and built for AI/subscription products
- Users select a tier, make a payment, and get immediate access

**Credit System** - The Fairness Engine
- Each subscription tier comes with a monthly credit allowance:
  - $20/month = ~$18 in credits
  - $60/month = ~$60 in credits
  - $200/month = ~$180-190 in credits
- All tiers get access to the same models (Claude, GPT, Grok, etc.)
- The difference: **How many requests you can make**
- Premium models cost more credits; cheaper models cost less
- When credits run out: Either requests fail, or we charge pay-as-you-go (if the user opted in)

### **Layer 3: The Gateway (Where the Magic Happens)**

**The API Gateway** - The bridge between users and AI models
- Receives requests from IDEs or third-party apps with an API key or OAuth token
- Validates: Does this user have credits left?
- Routes the request to the appropriate LLM provider (Claude, GPT, Grok)
- Charges the user's account based on which model they used
- Sends real-time updates to third-party apps about credit usage
- Returns the AI response to the user

**Key Philosophy**
- User chooses which model to use (not us)
- User can switch models anytime without re-subscribing
- Pricing is transparent: We show exactly how many credits each request cost

---

## Tools & Services We're Evaluating

| Layer | Tool | Status | Notes |
|-------|------|--------|-------|
| **Authentication** | WorkOS | ✅ Decided | Already integrated, using for both direct auth and OAuth |
| **Payments** | Dodo Payments vs. Paddle | ⚠️ Deciding | **Dodo**: Lower costs, UPI support, built for AI products. **Paddle**: Excellent docs, strong reputation, unclear India support. Final decision pending. |
| **Database** | Convex | ✅ Decided | convex with Clean WorkOS integration. |
| **Frontend** | Next.js + Vercel | ✅ Decided | Already set up, easy deployment |
| **Backend Gateway** | ElysiaJS | ✅ Decided | Already being tested separately, will integrate later |
| **LLM Providers** | Grok, GROQ, Cerebrus | ✅ Decided | Already integrated and tested |
| **Deployment** | Vercel | ✅ Decided | Generous rate limits, easy scaling |

**Key Decision Points Still Open:**
1. **Payment Provider** - Dodo Payments (cost-effective, UPI support) vs. Paddle (proven, great docs)
2. **Database** - SingleStore + Drizzle (clean integration) vs. Convex (bundled but WorkOS challenges)

---

## Our Purpose & Long-Term Vision

### Immediate (Next 6 Weeks)
Get the gateway live with:
- User registration & subscription management
- API key system working
- OAuth for third-party apps
- Basic credit tracking

### Medium-Term (Months 2-3)
- Launch with real IDEs (Zed, OpenCode)
- Get first third-party developers building on top of us
- Refine credit pricing based on real usage data

### Long-Term Vision
- Become the **default gateway for AI model access**
- Support 50+ models across multiple providers
- Enable developers to build on top of us without dealing with payment complexity
- Create a marketplace where developers can build AI tools without infrastructure overhead

---

## Key Principles Guiding Our Decisions

1. **User Freedom** - No vendor lock-in. Your subscription works everywhere.
2. **Transparency** - Users know exactly what they're paying for.
3. **Simplicity** - One subscription, all models, straightforward pricing.
4. **Developer-First** - Make it stupidly easy for devs to integrate.
5. **India-Friendly** - Support Indian payment methods (UPI) from day one.

---

## What Success Looks Like

✅ Users can buy a subscription once and use it across multiple tools  
✅ Developers can say "yes" when users ask to bring their own subscription  
✅ We handle all the payment/billing complexity so devs can focus on their product  
✅ Users save money because they don't need multiple subscriptions  
✅ We generate sustainable revenue through subscriptions

---

---


3. **Build Phase 1** - User registration + dashboard skeleton
4. **Build Phase 2** - Subscription tiers + credit system
5. **Build Phase 3** - API key system
6. **Build Phase 4** - OAuth integration with WorkOS Connect
7. **Integration** - Bring in ElysiaJS gateway backend
8. **Testing** - Real-world testing with Zed, OpenCode
9. **Launch** - Beta release to early users

---

## Questions for Decision-Making

As we move forward, these are the critical questions:


3. **LLM Routing**: When we merge the ElysiaJS backend, how do we handle model provider failover?
4. **Credit Pricing**: Should model credits be manually set, or automatically adjusted based on provider costs?
5. **Third-Party Developer Onboarding**: Do we want a self-serve OAuth app registration, or manual approval process?

---

## Summary

We're building a **unified AI model subscription gateway** that solves the fragmentation problem in the AI tools space. Users get freedom, developers get simplicity, and we create a sustainable business model. We're at the infrastructure decision phase, and once we nail those choices, the path to launch is clear.

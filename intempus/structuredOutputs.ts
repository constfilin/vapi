import { Vapi } from '@vapi-ai/server-sdk';
import * as Contacts from '../Contacts';

type CreateStructuredOutputDtoWithType = Vapi.CreateStructuredOutputDto & {
    type: 'ai';
};

const _getDefaultAssistantIds = (
    assistantsByName?: Record<string, Vapi.Assistant>
): string[] | undefined => {
    if (!assistantsByName)
        return undefined;
    return Object.values(assistantsByName)
        .filter(a => a.name !== 'IntempusBot')
        .map(a => a.id);
};

/**
 * Structured Output: Call Summary
 * Extracts key information from the conversation including:
 * - Caller's name and contact info
 * - Property address (if mentioned)
 * - Issue or inquiry type
 * - Action items
 * - Sentiment
 */
export const getCallSummary = (
    contacts            : Contacts.Contact[],
    assistantsByName?   : Record<string,Vapi.Assistant>
): CreateStructuredOutputDtoWithType => {
    const assistantIds = _getDefaultAssistantIds(assistantsByName);
    return {
        name        : "CallSummary",
        description : "Extracts structured call summary data including caller information, property details, inquiry type, and action items from the conversation.",
        type        : "ai",
        assistantIds,
        schema: {
            type: "object",
            properties: {
                callerName: {
                    type: "string",
                    description: "The name of the person calling"
                },
                callerPhone: {
                    type: "string",
                    description: "The phone number of the caller if provided"
                },
                callerEmail: {
                    type: "string",
                    description: "The email address of the caller if provided"
                },
                propertyAddress: {
                    type: "string",
                    description: "The property address mentioned in the call, if any"
                },
                inquiryType: {
                    type: "string",
                    enum: [
                        "HOA Services",
                        "Property Management",
                        "Maintenance Request",
                        "Leasing Inquiry",
                        "Billing/Payment",
                        "Emergency Maintenance",
                        "General Inquiry",
                        "Other"
                    ],
                    description: "The type of inquiry or reason for the call"
                },
                inquirySummary: {
                    type: "string",
                    description: "A brief summary of the caller's inquiry or request"
                },
                actionItems: {
                    type: "array",
                    items: {
                        type: "string"
                    },
                    description: "List of action items or next steps identified during the call"
                },
                sentiment: {
                    type: "string",
                    enum: ["positive", "neutral", "negative", "urgent"],
                    description: "The overall sentiment or urgency of the call"
                },
                callTransferred: {
                    type: "boolean",
                    description: "Whether the call was transferred to another person or department"
                },
                transferredTo: {
                    type: "string",
                    description: "Name or department the call was transferred to, if applicable"
                }
            },
            required: ["callerName","callerPhone","callerEmail","propertyAddress","inquiryType", "inquirySummary", "actionItems", "sentiment", "callTransferred", "transferredTo"],
        }
    };
};

/**
 * Structured Output: Customer Feedback
 * Extracts feedback and satisfaction data from customer interactions
 */
export const getCustomerFeedback = (
    contacts            : Contacts.Contact[],
    assistantsByName?   : Record<string,Vapi.Assistant>
): CreateStructuredOutputDtoWithType => {
    const assistantIds = _getDefaultAssistantIds(assistantsByName);
    return {
        name        : "CustomerFeedback",
        description : "Extracts customer feedback and satisfaction metrics from conversations.",
        type        : "ai",
        assistantIds,
        schema: {
            type: "object",
            properties: {
                satisfactionLevel: {
                    type: "string",
                    enum: ["very-satisfied", "satisfied", "neutral", "dissatisfied", "very-dissatisfied"],
                    description: "Overall satisfaction level expressed by the customer"
                },
                feedbackText: {
                    type: "string",
                    description: "The actual feedback or comments provided by the customer"
                },
                issuesResolved: {
                    type: "boolean",
                    description: "Whether the customer's issues were resolved during the call"
                },
                followUpNeeded: {
                    type: "boolean",
                    description: "Whether follow-up action is needed"
                },
                improvementAreas: {
                    type: "array",
                    items: {
                        type: "string"
                    },
                    description: "Areas mentioned for potential improvement"
                }
            },
            required: ["satisfactionLevel", "feedbackText", "issuesResolved"]
        }
    };
};

/**
 * Structured Output: Maintenance Request Details
 * Captures specific details about maintenance requests
 */
export const getMaintenanceRequest = (
    contacts            : Contacts.Contact[],
    assistantsByName?   : Record<string, Vapi.Assistant>
): CreateStructuredOutputDtoWithType => {
    const assistantIds = _getDefaultAssistantIds(assistantsByName);
    return {
        name        : "MaintenanceRequest",
        description : "Extracts detailed information about maintenance requests including urgency, type, and location.",
        type        : "ai",
        assistantIds,
        schema: {
            type: "object",
            properties: {
                propertyAddress: {
                    type: "string",
                    description: "Full address of the property requiring maintenance"
                },
                urgencyLevel: {
                    type: "string",
                    enum: ["emergency", "urgent", "routine", "scheduled"],
                    description: "The urgency level of the maintenance request"
                },
                maintenanceType: {
                    type: "string",
                    enum: [
                        "Plumbing",
                        "Electrical",
                        "HVAC",
                        "Appliance",
                        "Structural",
                        "Landscaping",
                        "Pest Control",
                        "Other"
                    ],
                    description: "The category of maintenance needed"
                },
                issueDescription: {
                    type: "string",
                    description: "Detailed description of the maintenance issue"
                },
                accessInstructions: {
                    type: "string",
                    description: "Instructions for accessing the property"
                },
                preferredContactMethod: {
                    type: "string",
                    enum: ["phone", "email", "text"],
                    description: "Preferred method to contact the requester"
                },
                tenantName: {
                    type: "string",
                    description: "Name of the tenant reporting the issue"
                },
                tenantPhone: {
                    type: "string",
                    description: "Phone number of the tenant"
                },
                bestTimeToContact: {
                    type: "string",
                    description: "Best time to contact the tenant for scheduling"
                }
            },
            required: ["propertyAddress", "urgencyLevel", "maintenanceType", "issueDescription"]
        }
    };
}

/**
 * Structured Output: Leasing Inquiry
 * Captures information from potential tenants
 */
export const getLeasingInquiry = (
    contacts            : Contacts.Contact[],
    assistantsByName?   : Record<string, Vapi.Assistant>
): CreateStructuredOutputDtoWithType => {
    const assistantIds = _getDefaultAssistantIds(assistantsByName);
    return {
        name            : "LeasingInquiry",
        description     : "Extracts information from prospective tenant inquiries about available properties.",
        type            : "ai",
        assistantIds,
        schema: {
            type: "object",
            properties: {
                prospectName: {
                    type: "string",
                    description: "Name of the prospective tenant"
                },
                prospectPhone: {
                    type: "string",
                    description: "Phone number of the prospect"
                },
                prospectEmail: {
                    type: "string",
                    description: "Email address of the prospect"
                },
                desiredLocation: {
                    type: "string",
                    description: "Desired location or area for the rental property"
                },
                budgetRange: {
                    type: "string",
                    description: "Budget range for monthly rent"
                },
                numberOfBedrooms: {
                    type: "number",
                    description: "Desired number of bedrooms"
                },
                moveInDate: {
                    type: "string",
                    description: "Desired move-in date"
                },
                petsInfo: {
                    type: "string",
                    description: "Information about pets, if any"
                },
                numberOfOccupants: {
                    type: "number",
                    description: "Number of people who will be living in the property"
                },
                employmentStatus: {
                    type: "string",
                    description: "Employment status of the prospect"
                },
                specialRequirements: {
                    type: "string",
                    description: "Any special requirements or preferences"
                }
            },
            required: ["prospectName", "desiredLocation", "moveInDate"]
        }
    };
}

/**
 * Structured Output: Property Owner Request
 * Captures information from property owners
 */
export const getPropertyOwnerRequest = (
    contacts            : Contacts.Contact[],
    assistantsByName?   : Record<string, Vapi.Assistant>
): CreateStructuredOutputDtoWithType => {
    const assistantIds = _getDefaultAssistantIds(assistantsByName);
    return {
        name            : "PropertyOwnerRequest",
        description     : "Extracts information from property owner inquiries about management services, rentals, or sales.",
        type            : "ai",
        assistantIds,
        schema: {
            type: "object",
            properties: {
                ownerName: {
                    type: "string",
                    description: "Name of the property owner"
                },
                ownerPhone: {
                    type: "string",
                    description: "Phone number of the property owner"
                },
                ownerEmail: {
                    type: "string",
                    description: "Email address of the property owner"
                },
                propertyAddress: {
                    type: "string",
                    description: "Address of the property"
                },
                serviceType: {
                    type: "string",
                    enum: [
                        "Property Management",
                        "Rental Services",
                        "Selling Property",
                        "HOA Management",
                        "Consultation"
                    ],
                    description: "Type of service the owner is interested in"
                },
                propertyType: {
                    type: "string",
                    enum: ["Single Family", "Multi-Family", "Condo", "Townhouse", "Commercial"],
                    description: "Type of property"
                },
                currentStatus: {
                    type: "string",
                    enum: ["vacant", "owner-occupied", "tenant-occupied"],
                    description: "Current status of the property"
                },
                inquiryDetails: {
                    type: "string",
                    description: "Detailed description of the owner's inquiry or needs"
                },
                isExistingClient: {
                    type: "boolean",
                    description: "Whether the owner is already a client of Intempus"
                },
                preferredCallbackTime: {
                    type: "string",
                    description: "Preferred time for callback"
                }
            },
            required: ["ownerName", "propertyAddress", "serviceType"]
        }
    };
}

export const getCallSuccessRating = (
    contacts            : Contacts.Contact[],
    assistantsByName?   : Record<string,Vapi.Assistant>
) : CreateStructuredOutputDtoWithType => {
    const assistantIds = _getDefaultAssistantIds(assistantsByName);
    return {
        name        : "CallSuccessRating",
        description : "Determines whether the call successfully resolved the customer's issue or inquiry.",
        type        : "ai",
        assistantIds,
        schema: {
            type: "object",
            properties: {
                issueResolved: {
                    type: "boolean",
                    description: "Whether the customer's issue or inquiry was resolved during the call"
                },
                successRating: {
                    type: "integer",
                    minimum: 1,
                    maximum: 10,
                    description: "Rate the success of the call in resolving the customer's needs on a scale of 1 to 10"
                }
            },
            required: ["issueResolved", "successRating"]
        }
    };
}
import "server-only";

import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import type { WriterLetterType, WriterTemplate } from "./types";

export const TEMPLATES: WriterTemplate[] = [
  {
    id: "courrier-administratif-simple",
    name: "Courrier administratif simple",
    description: "Lettre formelle vers une administration (CAF, CPAM, mairie…).",
    letterType: "administratif",
    variables: ["destinataire", "adresse_destinataire", "objet", "reference", "signature"],
  },
  {
    id: "relance",
    name: "Relance",
    description: "Relance simple après un premier courrier resté sans réponse.",
    letterType: "administratif",
    variables: ["destinataire", "objet", "reference", "signature"],
  },
  {
    id: "mise-en-demeure-simple",
    name: "Mise en demeure simple",
    description: "Mise en demeure formelle, sans clauses juridiques avancées.",
    letterType: "avocat",
    variables: ["destinataire", "adresse_destinataire", "objet", "reference", "signature"],
  },
  {
    id: "courrier-employeur",
    name: "Courrier employeur",
    description: "Lettre type adressée à un employeur (RH, manager).",
    letterType: "employeur",
    variables: ["destinataire", "adresse_destinataire", "objet", "reference", "signature"],
  },
  {
    id: "courrier-caf",
    name: "Courrier CAF",
    description: "Courrier type à la CAF (numéro d'allocataire, objet précis).",
    letterType: "caf",
    variables: ["destinataire", "objet", "reference", "signature"],
  },
  {
    id: "courrier-cpam",
    name: "Courrier CPAM",
    description: "Courrier type à l'assurance maladie.",
    letterType: "cpam",
    variables: ["destinataire", "objet", "reference", "signature"],
  },
  {
    id: "courrier-notaire",
    name: "Courrier notaire",
    description: "Courrier formel à destination d'un notaire.",
    letterType: "notaire",
    variables: ["destinataire", "adresse_destinataire", "objet", "reference", "signature"],
  },
  {
    id: "courrier-avocat",
    name: "Courrier avocat",
    description: "Courrier formel à destination d'un avocat ou cabinet.",
    letterType: "avocat",
    variables: ["destinataire", "adresse_destinataire", "objet", "reference", "signature"],
  },
  {
    id: "courrier-assurance",
    name: "Courrier assurance",
    description: "Courrier type à un assureur (déclaration, demande d'information).",
    letterType: "assurance",
    variables: ["destinataire", "objet", "reference", "signature"],
  },
  {
    id: "resiliation",
    name: "Résiliation",
    description: "Lettre de résiliation (article L121-25 / résiliation à échéance).",
    letterType: "libre",
    variables: ["destinataire", "objet", "reference", "signature"],
  },
  {
    id: "contestation",
    name: "Contestation",
    description: "Lettre de contestation d'une décision ou d'une facture.",
    letterType: "libre",
    variables: ["destinataire", "objet", "reference", "signature"],
  },
  {
    id: "libre",
    name: "Document vierge",
    description: "Un document docx vierge pour démarrer librement.",
    letterType: "libre",
    variables: [],
  },
];

export function findTemplate(id: string): WriterTemplate | null {
  return TEMPLATES.find((template) => template.id === id) ?? null;
}

export function templatesForLetterType(type: WriterLetterType): WriterTemplate[] {
  return TEMPLATES.filter((template) => template.letterType === type || template.letterType === "libre");
}

type GenerateOptions = {
  template?: WriterTemplate | null;
  recipient?: string;
  recipientAddress?: string;
  subject?: string;
  reference?: string;
  city?: string;
};

function formattedDate(): string {
  return new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export async function generateInitialDocx(options: GenerateOptions = {}): Promise<Buffer> {
  const template = options.template ?? null;
  const recipient = options.recipient ?? "[Destinataire]";
  const recipientAddress = options.recipientAddress ?? "[Adresse]";
  const subject = options.subject ?? "[Objet]";
  const reference = options.reference ?? "[Référence]";
  const city = options.city ?? "[Ville]";

  const isBlank = !template || template.id === "libre";

  const paragraphs: Paragraph[] = [];

  if (!isBlank) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: "[Vos nom et adresse]", color: "64748b" })],
      }),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun(recipient)],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun(recipientAddress)],
      }),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun(`${city}, le ${formattedDate()}`)],
      }),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({
        children: [new TextRun({ text: `Objet : ${subject}`, bold: true })],
      }),
    );
    if (reference && reference !== "[Référence]") {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: `Référence : ${reference}` })],
        }),
      );
    }
    paragraphs.push(
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({
        children: [new TextRun(`Madame, Monsieur,`)],
      }),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({
        children: [
          new TextRun(
            "[Corps du courrier — remplacez ce paragraphe par votre texte. Ce modèle a été pré-rempli depuis la GED AzServer.]",
          ),
        ],
      }),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({
        children: [
          new TextRun(
            "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
          ),
        ],
      }),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "[Signature]", italics: true, color: "64748b" })],
      }),
    );
  } else {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: "Nouveau document", bold: true, size: 32 })],
      }),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({
        children: [
          new TextRun(
            "Commencez à rédiger votre document. Cette page a été créée depuis GED AzServer.",
          ),
        ],
      }),
    );
  }

  const doc = new Document({
    creator: "GED AzServer",
    title: subject,
    description: template ? template.name : "Document de rédaction",
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

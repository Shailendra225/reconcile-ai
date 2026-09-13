import { db } from "@/lib/db";

type OpenInvoice = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  totalAmount: unknown;

  customer: {
    id: string;
    name: string;
    upiId: string | null;
  };

  allocations: {
    amount: unknown;
  }[];
};

type InvoiceWithBalance = {
  invoice: OpenInvoice;
  balance: number;
};

function moneyToPaise(amount: number) {
  return Math.round(amount * 100);
}

function findExactCombinations(
  invoices: InvoiceWithBalance[],
  transactionAmount: number
) {
  const target =
    moneyToPaise(transactionAmount);

  const combinations: InvoiceWithBalance[][] =
    [];

  // ============================
  // 2-INVOICE COMBINATIONS
  // ============================

  for (
    let i = 0;
    i < invoices.length;
    i++
  ) {
    for (
      let j = i + 1;
      j < invoices.length;
      j++
    ) {
      const total =
        moneyToPaise(
          invoices[i].balance
        ) +
        moneyToPaise(
          invoices[j].balance
        );

      if (total === target) {
        combinations.push([
          invoices[i],
          invoices[j],
        ]);
      }
    }
  }

  // ============================
  // 3-INVOICE COMBINATIONS
  // ============================

  for (
    let i = 0;
    i < invoices.length;
    i++
  ) {
    for (
      let j = i + 1;
      j < invoices.length;
      j++
    ) {
      for (
        let k = j + 1;
        k < invoices.length;
        k++
      ) {
        const total =
          moneyToPaise(
            invoices[i].balance
          ) +
          moneyToPaise(
            invoices[j].balance
          ) +
          moneyToPaise(
            invoices[k].balance
          );

        if (total === target) {
          combinations.push([
            invoices[i],
            invoices[j],
            invoices[k],
          ]);
        }
      }
    }
  }

  return combinations;
}

export async function runReconciliation(
  businessId: string
) {
  // ==========================================
  // FETCH ALL REQUIRED DATA IN PARALLEL
  // ==========================================

  const [
    transactions,
    invoices,
    rejectedMatches,
    existingMatches,
  ] = await Promise.all([
    db.bankTransaction.findMany({
      where: {
        businessId: businessId,
        direction: "CREDIT",
        status: "UNMATCHED",
      },

      orderBy: {
        transactionDate: "asc",
      },
    }),

    db.invoice.findMany({
      where: {
        businessId: businessId,

        status: {
          in: [
            "SENT",
            "PARTIALLY_PAID",
          ],
        },
      },

      include: {
        customer: true,

        allocations: {
          select: {
            amount: true,
          },
        },
      },
    }),

    db.reconciliationMatch.findMany({
      where: {
        status: "REJECTED",

        bankTransaction: {
          businessId: businessId,
        },
      },

      select: {
        bankTransactionId: true,
        invoiceId: true,
      },
    }),

    db.reconciliationMatch.findMany({
      where: {
        bankTransaction: {
          businessId: businessId,
        },
      },

      select: {
        bankTransactionId: true,
        invoiceId: true,
      },
    }),
  ]);

  // ==========================================
  // PRE-CALCULATE OPEN INVOICE BALANCES
  // ==========================================

  const invoiceBalances: InvoiceWithBalance[] =
    [];

  for (const invoice of invoices) {
    const totalPaid =
      invoice.allocations.reduce(
        (sum, allocation) =>
          sum +
          Number(allocation.amount),
        0
      );

    const balance =
      Number(invoice.totalAmount) -
      totalPaid;

    if (balance <= 0) {
      continue;
    }

    invoiceBalances.push({
      invoice:
        invoice as OpenInvoice,
      balance,
    });
  }

  // ==========================================
  // BUILD REJECTED MATCH LOOKUP
  // ==========================================

  const rejectedByTransaction =
    new Map<string, Set<string>>();

  for (const match of rejectedMatches) {
    const set =
      rejectedByTransaction.get(
        match.bankTransactionId
      ) ?? new Set<string>();

    set.add(match.invoiceId);

    rejectedByTransaction.set(
      match.bankTransactionId,
      set
    );
  }

  // ==========================================
  // BUILD EXISTING MATCH LOOKUP
  // ==========================================

  const existingMatchKeys =
    new Set<string>();

  for (const match of existingMatches) {
    existingMatchKeys.add(
      `${match.bankTransactionId}:${match.invoiceId}`
    );
  }

  let suggested = 0;
  let noMatch = 0;

  // ==========================================
  // PROCESS TRANSACTIONS
  // ==========================================

  for (const transaction of transactions) {
    const transactionAmount =
      Number(transaction.amount);

    const narration =
      `${transaction.description} ${
        transaction.reference ?? ""
      }`.toLowerCase();

    const rejectedInvoiceIds =
      rejectedByTransaction.get(
        transaction.id
      ) ?? new Set<string>();

    // ========================================
    // FILTER ELIGIBLE OPEN INVOICES
    // ========================================

    const openInvoices =
      invoiceBalances.filter(
        (item) =>
          !rejectedInvoiceIds.has(
            item.invoice.id
          )
      );

    // ========================================
    // STEP 1: SINGLE INVOICE MATCH
    // ========================================

    let bestMatch:
      | {
          invoiceId: string;
          score: number;
          reason: string[];
          matchedAmount: number;
        }
      | null = null;

    for (const item of openInvoices) {
      const invoice =
        item.invoice;

      const balance =
        item.balance;

      let score = 0;

      const reasons: string[] =
        [];

      // Exact outstanding amount
      if (
        Math.abs(
          transactionAmount -
            balance
        ) < 0.01
      ) {
        score += 0.55;

        reasons.push(
          "Exact outstanding amount match"
        );
      }

      // Partial payment
      else if (
        transactionAmount > 0 &&
        transactionAmount <
          balance
      ) {
        score += 0.35;

        reasons.push(
          `Possible partial payment of ₹${transactionAmount.toFixed(
            2
          )} against outstanding balance ₹${balance.toFixed(
            2
          )}`
        );
      }

      // Invoice number
      if (
        invoice.invoiceNumber &&
        narration.includes(
          invoice.invoiceNumber.toLowerCase()
        )
      ) {
        score += 0.3;

        reasons.push(
          `Invoice number ${invoice.invoiceNumber} found in transaction`
        );
      }

      // Customer name
      if (
        invoice.customer?.name &&
        narration.includes(
          invoice.customer.name.toLowerCase()
        )
      ) {
        score += 0.15;

        reasons.push(
          `Customer name ${invoice.customer.name} found in transaction`
        );
      }

      // UPI ID
      if (
        invoice.customer?.upiId &&
        narration.includes(
          invoice.customer.upiId.toLowerCase()
        )
      ) {
        score += 0.15;

        reasons.push(
          `UPI ID ${invoice.customer.upiId} found`
        );
      }

      score =
        Math.min(score, 0.99);

      if (
        !bestMatch ||
        score >
          bestMatch.score
      ) {
        bestMatch = {
          invoiceId:
            invoice.id,

          score,

          reason:
            reasons,

          matchedAmount:
            Math.min(
              transactionAmount,
              balance
            ),
        };
      }
    }

    // ========================================
    // SINGLE MATCH FOUND
    // ========================================

    if (
      bestMatch &&
      bestMatch.score >= 0.65
    ) {
      const key =
        `${transaction.id}:${bestMatch.invoiceId}`;

      if (
        !existingMatchKeys.has(
          key
        )
      ) {
        await db.reconciliationMatch.create({
          data: {
            bankTransactionId:
              transaction.id,

            invoiceId:
              bestMatch.invoiceId,

            confidenceScore:
              bestMatch.score,

            matchedAmount:
              bestMatch.matchedAmount,

            status:
              "SUGGESTED",

            reason:
              bestMatch.reason.join(
                ", "
              ),
          },
        });

        existingMatchKeys.add(key);
      }

      await db.bankTransaction.update({
        where: {
          id:
            transaction.id,
        },

        data: {
          status:
            "SUGGESTED",
        },
      });

      suggested++;

      continue;
    }

    // ========================================
    // STEP 2: COMBINED PAYMENT MATCH
    // ========================================

    const invoicesByCustomer =
      new Map<
        string,
        InvoiceWithBalance[]
      >();

    for (const item of openInvoices) {
      const customerId =
        item.invoice.customerId;

      const existing =
        invoicesByCustomer.get(
          customerId
        ) ?? [];

      existing.push(item);

      invoicesByCustomer.set(
        customerId,
        existing
      );
    }

    const combinedCandidates: {
      invoices: InvoiceWithBalance[];
      score: number;
      reasons: string[];
    }[] = [];

    for (
      const customerInvoices
      of invoicesByCustomer.values()
    ) {
      if (
        customerInvoices.length < 2
      ) {
        continue;
      }

      const customer =
        customerInvoices[0]
          .invoice.customer;

      const customerNameFound =
        Boolean(
          customer?.name &&
            narration.includes(
              customer.name.toLowerCase()
            )
        );

      const upiFound =
        Boolean(
          customer?.upiId &&
            narration.includes(
              customer.upiId.toLowerCase()
            )
        );

      const combinations =
        findExactCombinations(
          customerInvoices,
          transactionAmount
        );

      for (
        const combination
        of combinations
      ) {
        let score = 0.55;

        const reasons: string[] =
          [
            `Combined outstanding balances exactly equal transaction amount ₹${transactionAmount.toFixed(
              2
            )}`,
          ];

        if (customerNameFound) {
          score += 0.2;

          reasons.push(
            `Customer name ${customer.name} found in transaction`
          );
        }

        if (upiFound) {
          score += 0.15;

          reasons.push(
            `UPI ID ${customer.upiId} found`
          );
        }

        let invoiceNumbersFound =
          0;

        for (
          const item
          of combination
        ) {
          if (
            narration.includes(
              item.invoice.invoiceNumber.toLowerCase()
            )
          ) {
            invoiceNumbersFound++;
          }
        }

        if (
          invoiceNumbersFound > 0
        ) {
          score +=
            Math.min(
              invoiceNumbersFound *
                0.1,
              0.2
            );

          reasons.push(
            `${invoiceNumbersFound} invoice reference${
              invoiceNumbersFound ===
              1
                ? ""
                : "s"
            } found in transaction`
          );
        }

        score =
          Math.min(
            score,
            0.99
          );

        if (score >= 0.65) {
          combinedCandidates.push({
            invoices:
              combination,

            score,

            reasons,
          });
        }
      }
    }

    // ========================================
    // SAFE COMBINED MATCH
    // ========================================

    if (
      combinedCandidates.length === 1
    ) {
      const combinedMatch =
        combinedCandidates[0];

      const createData =
        combinedMatch.invoices
          .filter((item) => {
            const key =
              `${transaction.id}:${item.invoice.id}`;

            return !existingMatchKeys.has(
              key
            );
          })
          .map((item) => {
            const invoice =
              item.invoice;

            return {
              bankTransactionId:
                transaction.id,

              invoiceId:
                invoice.id,

              confidenceScore:
                combinedMatch.score,

              matchedAmount:
                item.balance,

              status:
                "SUGGESTED" as const,

              reason:
                [
                  ...combinedMatch.reasons,

                  `Combined payment allocation: ₹${item.balance.toFixed(
                    2
                  )} → ${invoice.invoiceNumber}`,
                ].join(", "),
            };
          });

      if (
        createData.length > 0
      ) {
        await db.reconciliationMatch.createMany({
          data:
            createData,
        });

        for (const item of createData) {
          existingMatchKeys.add(
            `${item.bankTransactionId}:${item.invoiceId}`
          );
        }
      }

      await db.bankTransaction.update({
        where: {
          id:
            transaction.id,
        },

        data: {
          status:
            "SUGGESTED",
        },
      });

      suggested++;

      continue;
    }

    noMatch++;
  }

  return {
    scanned:
      transactions.length,

    suggested,

    noMatch,
  };
}
package com.pos.app.Enum;

public enum PaymentMethod {

	CASH, CARD, UPI,

	/**
	 * Bill amount split between cash and an online mode (CARD/UPI) at the same time,
	 * e.g. half paid in cash, half via UPI. The actual split amounts are stored on
	 * the invoice as cashAmount / onlineAmount, and onlinePayMethod records which
	 * online mode (CARD or UPI) was used for the online portion.
	 */
	SPLIT
}

import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TablaRepuestos } from '../../src/ui/componentes/TablaRepuestos';
import type { RepuestoDatos } from '../../src/dominio/repuesto';

function Envoltura() {
  const [v, setV] = useState<RepuestoDatos[]>([]);
  return <TablaRepuestos valor={v} onCambio={setV} tareas={[1]} editable />;
}

describe('TablaRepuestos', () => {
  it('pegar desde Excel agrega filas y calcula el total', () => {
    render(<Envoltura />);
    fireEvent.click(screen.getByRole('button', { name: /pegar desde excel/i }));
    fireEvent.change(screen.getByLabelText(/filas copiadas/i), { target: { value: '81380\t4364440\tTAPON\t2\t1\tNIMAC\tC1-2A3\t18.05\tDISPONIBLE\nmal\t\t\t\t' } });
    expect(screen.getByText(/1 fila lista/i)).toBeInTheDocument();
    expect(screen.getByText('Fila 2: falta No. parte o descripción')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /agregar 1/i }));
    expect(screen.getByDisplayValue('4364440')).toBeInTheDocument();
    expect(screen.getByText('USD 36.10')).toBeInTheDocument();
  });
  it('pegar directo sobre la tabla también funciona', () => {
    render(<Envoltura />);
    fireEvent.paste(screen.getByTestId('zona-repuestos'), { clipboardData: { getData: () => '1\tP-9\tFILTRO\t3\t\t\t\t10' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar 1/i }));
    expect(screen.getByDisplayValue('P-9')).toBeInTheDocument();
    expect(screen.getByText('USD 30.00')).toBeInTheDocument();
  });
  it('lista de la Consulta de Repuestos: reconoce columnas y permite cambiarlas', () => {
    render(<Envoltura />);
    fireEvent.click(screen.getByRole('button', { name: /pegar desde excel/i }));
    fireEvent.change(screen.getByLabelText(/filas copiadas/i), { target: { value: 'CODIGO\tN° PARTE\tDESCRIPCION\tUND\tCANTIDAD\tALMACEN\tUBICACION\tAREA\n81380\t4364440\tTAPON\tEA\t2\tCONSIGNADO NIMAC\tC1-2A3\tCONSIGNADO NIMAC' } });
    expect(screen.getByText(/reconocidas por el encabezado/i)).toBeInTheDocument();
    expect((screen.getByLabelText('Columna 5') as HTMLSelectElement).value).toBe('cantidad');
    fireEvent.change(screen.getByLabelText('Columna 8'), { target: { value: 'almacen' } });
    fireEvent.change(screen.getByLabelText('Columna 6'), { target: { value: 'ignorar' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar 1/i }));
    expect(screen.getByDisplayValue('4364440')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('CONSIGNADO NIMAC')).toHaveLength(1);
  });
});

describe('TablaRepuestos columna por columna', () => {
  it('pegar una columna en la celda llena hacia abajo y otra columna después', () => {
    render(<Envoltura />);
    fireEvent.paste(screen.getByLabelText('numeroParte 1'), { clipboardData: { getData: () => '1R-0716\n4364440\n2435336\n' } });
    expect(screen.getByLabelText('numeroParte 3')).toHaveValue('2435336');
    fireEvent.paste(screen.getByLabelText('cantidad 1'), { clipboardData: { getData: () => '2\n4\n1' } });
    fireEvent.paste(screen.getByLabelText('precio 1'), { clipboardData: { getData: () => '10\n2.5\n100' } });
    expect(screen.getByText('USD 130.00')).toBeInTheDocument();
    fireEvent.paste(screen.getByLabelText('cantidad 3'), { clipboardData: { getData: () => 'tres\n0' } });
    expect(screen.getByText(/cantidad "tres" no válida/)).toBeInTheDocument();
  });
});

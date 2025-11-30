import React, { useState } from 'react';
import { Button, InputGroup, Form } from 'react-bootstrap';
import { Calendar, Calendar3 } from 'react-bootstrap-icons';

/**
 * Componente de filtros rápidos por dias
 * Permite selecionar rapidamente períodos comuns ou digitar um número customizado
 */
function FiltrosRapidosDias({ onFiltroAplicado }) {
  const [diasCustomizados, setDiasCustomizados] = useState('');

  /**
   * Calcula as datas baseado em quantos dias atrás
   */
  const calcularDatas = (dias) => {
    const hoje = new Date();
    const dataFim = new Date(hoje);
    dataFim.setHours(23, 59, 59, 999); // Fim do dia de hoje

    const dataInicio = new Date(hoje);
    dataInicio.setDate(dataInicio.getDate() - dias);
    dataInicio.setHours(0, 0, 0, 0); // Início do dia

    return {
      dataInicio: dataInicio.toISOString().split('T')[0], // Formato YYYY-MM-DD
      dataFim: dataFim.toISOString().split('T')[0]
    };
  };

  /**
   * Aplica filtro de dias
   */
  const aplicarFiltro = (dias) => {
    const datas = calcularDatas(dias);
    if (onFiltroAplicado) {
      onFiltroAplicado(datas.dataInicio, datas.dataFim);
    }
  };

  /**
   * Aplica filtro customizado
   */
  const aplicarFiltroCustomizado = () => {
    const dias = parseInt(diasCustomizados);
    if (isNaN(dias) || dias < 1) {
      alert('Por favor, digite um número válido de dias (mínimo 1)');
      return;
    }
    aplicarFiltro(dias);
    setDiasCustomizados(''); // Limpar após aplicar
  };

  /**
   * Handler para Enter no input
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      aplicarFiltroCustomizado();
    }
  };

  return (
    <div className="mb-3 p-3 bg-light rounded border">
      <div className="d-flex align-items-center mb-2">
        <Calendar3 className="me-2 text-primary" size={18} />
        <h6 className="mb-0">Filtros Rápidos por Dias</h6>
      </div>
      
      <div className="d-flex flex-wrap gap-2 align-items-center">
        {/* Botões de filtros rápidos */}
        <Button
          variant="outline-primary"
          size="sm"
          onClick={() => aplicarFiltro(1)}
          className="d-flex align-items-center"
        >
          <Calendar className="me-1" size={14} />
          Último Dia
        </Button>

        <Button
          variant="outline-primary"
          size="sm"
          onClick={() => aplicarFiltro(3)}
          className="d-flex align-items-center"
        >
          <Calendar className="me-1" size={14} />
          Últimos 3 Dias
        </Button>

        <Button
          variant="outline-primary"
          size="sm"
          onClick={() => aplicarFiltro(6)}
          className="d-flex align-items-center"
        >
          <Calendar className="me-1" size={14} />
          Últimos 6 Dias
        </Button>

        {/* Separador visual */}
        <div className="vr" style={{ height: '24px' }}></div>

        {/* Input para dias customizados */}
        <InputGroup style={{ width: 'auto', minWidth: '200px' }}>
          <InputGroup.Text className="small">Últimos</InputGroup.Text>
          <Form.Control
            type="number"
            placeholder="N"
            min="1"
            value={diasCustomizados}
            onChange={(e) => setDiasCustomizados(e.target.value)}
            onKeyPress={handleKeyPress}
            style={{ width: '80px' }}
            size="sm"
          />
          <InputGroup.Text className="small">dias</InputGroup.Text>
          <Button
            variant="primary"
            size="sm"
            onClick={aplicarFiltroCustomizado}
            disabled={!diasCustomizados || parseInt(diasCustomizados) < 1}
          >
            Aplicar
          </Button>
        </InputGroup>
      </div>
    </div>
  );
}

export default FiltrosRapidosDias;

